// IK constraints — rive IKConstraint::solve1 / solve2 (law of cosines), run after the forward pass.
// Model: component { type: 'IKConstraint', parent: <tip bone>, p: { targetId, parentBoneCount (0 = 1 bone, 1 = 2 bones),
//                    invertDirection, strength (0..1, default 1) } }
import type { Rig, Pose, Mat } from './types';
import { mul, invert, ident } from './math';

const num = (v: unknown, d: number) => { 'worklet'; return typeof v === 'number' ? v : d; };

function localMat(rig: Rig, pose: Pose, i: number): Mat {
  'worklet';
  const c = rig.components[i], p = pose.p[i];
  const x = c.type === 'Bone' ? num(pose.p[c.parent!].length, 0) : num(p.x, 0), y = c.type === 'Bone' ? 0 : num(p.y, 0);
  const r = num(p.rotation, 0), sx = num(p.scaleX, 1), sy = num(p.scaleY, 1), co = Math.cos(r), si = Math.sin(r);
  return [co * sx, si * sx, -si * sy, co * sy, x, y];
}

/** Recompute world transforms of `roots` and everything under them (parents-first order). */
export function recomputeFrom(rig: Rig, pose: Pose, roots: number[]) {
  'worklet';
  const dirty = new Array(rig.components.length).fill(false);
  for (const r of roots) dirty[r] = true;
  for (const i of rig.order) {
    const tp = rig.transformParent[i];
    if (!dirty[i] && !(tp != null && dirty[tp]) && !(rig.components[i].type === 'Bone' && dirty[rig.components[i].parent!])) continue;
    dirty[i] = true;
    const pw = tp == null ? ident() : pose.world[tp];
    pose.world[i] = rig.components[i].is.transform ? mul(pw, localMat(rig, pose, i)) : pw;
  }
}

const angleLerp = (a: number, b: number, t: number) => { 'worklet'; let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };

export function solveIK(rig: Rig, pose: Pose) {
  'worklet';
  const c = rig.components;
  for (let k = 0; k < c.length; k++) {
    if (c[k].type !== 'IKConstraint') continue;
    const P = pose.p[k], tip = c[k].parent!, target = num(P.targetId, -1);
    if (target < 0) continue;
    const strength = num(P.strength, 1), W = pose.world, tw = W[target];
    if (num(P.parentBoneCount, 1) === 0) {                          // one bone: point at the target
      const tp = rig.transformParent[tip]!, iw = invert(W[tp]);
      const px = W[tip][4], py = W[tip][5], dx = tw[4] - px, dy = tw[5] - py;
      const lx = iw[0] * dx + iw[2] * dy, ly = iw[1] * dx + iw[3] * dy;
      pose.p[tip].rotation = angleLerp(num(pose.p[tip].rotation, 0), Math.atan2(ly, lx), strength);
      recomputeFrom(rig, pose, [tip]);
      continue;
    }
    const b2 = tip, b1 = c[b2].parent!;                               // two bones: b1 → b2
    const iw = invert(W[rig.transformParent[b1]!]);
    const tr = (m: Mat, x: number, y: number) => [iw[0] * x + iw[2] * y + iw[4], iw[1] * x + iw[3] * y + iw[5]];
    const pA = tr(W[b1], W[b1][4], W[b1][5]), pC = tr(W[b2], W[b2][4], W[b2][5]);
    const L2 = num(pose.p[b2].length, 0), tipW = [W[b2][0] * L2 + W[b2][4], W[b2][1] * L2 + W[b2][5]];
    const pB = tr(W[b2], tipW[0], tipW[1]), pT = tr(tw, tw[4], tw[5]);
    const a = Math.hypot(pB[0] - pC[0], pB[1] - pC[1]), b = Math.hypot(pC[0] - pA[0], pC[1] - pA[1]);
    const cvx = pT[0] - pA[0], cvy = pT[1] - pA[1], cc = Math.hypot(cvx, cvy);
    const A = Math.acos(Math.max(-1, Math.min(1, (-a * a + b * b + cc * cc) / (2 * b * cc || 1))));
    const C = Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - cc * cc) / (2 * a * b || 1))));
    const base = Math.atan2(cvy, cvx), inv = P.invertDirection === true;
    const r1 = inv ? base - A : A + base, r2 = inv ? -C + Math.PI : C - Math.PI;
    pose.p[b1].rotation = angleLerp(num(pose.p[b1].rotation, 0), r1, strength);
    pose.p[b2].rotation = angleLerp(num(pose.p[b2].rotation, 0), r2, strength);
    recomputeFrom(rig, pose, [b1]);
  }
}
