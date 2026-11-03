// Twist rig — functional core. Rive's model and maths (see riv/FINDINGS.md), no Rive dependency.
// Every per-frame function is a pure function over plain data and carries a 'worklet' directive, so the whole
// evaluate → display-list step can run on the React Native UI thread (Reanimated); in plain JS the directive is inert.
import type { Rig, RigModel, Pose, Mat, Animation, DisplayList, DrawOp, PaintOp, PathCmd, Shader } from './types';

import { ident, mul, invert } from './math';
import { solveIK } from './ik';
export { ident, mul, invert };

const ax = (m: Mat, x: number, y: number) => { 'worklet'; return m[0] * x + m[2] * y + m[4]; };
const ay = (m: Mat, x: number, y: number) => { 'worklet'; return m[1] * x + m[3] * y + m[5]; };
const num = (v: unknown, d: number) => { 'worklet'; return typeof v === 'number' ? v : d; };

// ── compile: model → rig (topology precomputed once, on the JS thread) ──
export function compileRig(model: RigModel): Rig {
  const c = model.components, n = c.length;
  const kids: number[][] = c.map(() => []);
  c.forEach((o, i) => { if (i && o.parent != null && kids[o.parent]) kids[o.parent].push(i); });
  const transformParent = c.map((o, i) => { for (let p = o.parent; p != null; p = c[p].parent) if (c[p].is.transform || p === 0) return p; return i === 0 ? null : 0; });
  const order: number[] = []; const seen = new Array(n).fill(false);
  const visit = (i: number) => { if (seen[i]) return; seen[i] = true; const tp = transformParent[i]; if (tp != null) visit(tp); if (c[i].type === 'Bone' && c[i].parent != null) visit(c[i].parent!); order.push(i); };
  for (let i = 0; i < n; i++) visit(i);
  const of = (i: number, re: RegExp) => kids[i].filter(j => re.test(c[j].type));
  const rig: Rig = { ...model, kids, transformParent, order, drawables: [], paths: {}, paints: {}, verts: {}, skinOf: {}, tendons: {}, weightOf: {}, mutator: {}, stops: {}, clips: {}, clipShapes: {}, base: c.map(o => ({ ...o.p })) };
  c.forEach((o, i) => {
    if (o.type === 'Shape') { rig.paths[i] = kids[i].filter(j => c[j].is.path); rig.paints[i] = of(i, /^(Fill|Stroke)$/); }
    if (o.is.path) { rig.verts[i] = kids[i].filter(j => c[j].is.vertex); const s = of(i, /^Skin$/)[0]; if (s != null) rig.skinOf[i] = s; }
    if (o.type === 'Skin') rig.tendons[i] = of(i, /^Tendon$/);
    if (o.is.vertex) { const w = of(i, /Weight$/)[0]; if (w != null) rig.weightOf[i] = w; }
    if (/^(Fill|Stroke)$/.test(o.type)) { const m = of(i, /^(SolidColor|LinearGradient|RadialGradient)$/)[0]; if (m != null) rig.mutator[i] = m; }
    if (/Gradient$/.test(o.type)) rig.stops[i] = of(i, /^GradientStop$/);
    if (o.type === 'ClippingShape') {
      (rig.clips[o.parent!] ||= []).push(i);
      const src = num(o.p.sourceId, -1), shapes: number[] = [];
      const walk = (k: number) => { if (c[k].type === 'Shape') shapes.push(k); kids[k].forEach(walk); };
      if (src >= 0) walk(src);
      rig.clipShapes[src] = shapes;
    }
  });
  // Rive draws in reverse hierarchy order: the first item in the hierarchy ends up on top.
  rig.drawables = c.map((_, i) => i).filter(i => c[i].type === 'Shape').reverse();
  return rig;
}

export function createPose(rig: Rig): Pose {
  'worklet';
  return { p: rig.base.map(b => ({ ...b })), world: rig.components.map(() => ident()), opacity: rig.components.map(() => 1), hidden: rig.components.map(() => false), boneMats: {} };
}

/** Back to the authored values (call before applying animations for a frame). */
export function resetPose(rig: Rig, pose: Pose) {
  'worklet';
  for (let i = 0; i < rig.base.length; i++) { const b = rig.base[i], p = pose.p[i]; for (const k in p) if (!(k in b)) delete p[k]; for (const k in b) p[k] = b[k]; }
}

// ── easing ──
function cubicEase(x1: number, y1: number, x2: number, y2: number, x: number) {
  'worklet';
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bz = (t: number, a1: number, a2: number) => (((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t + 3 * a1) * t;
  const sl = (t: number, a1: number, a2: number) => 3 * (1 - 3 * a2 + 3 * a1) * t * t + 2 * (3 * a2 - 6 * a1) * t + 3 * a1;
  let t = x;
  for (let i = 0; i < 8; i++) { const s = sl(t, x1, x2); if (Math.abs(s) < 1e-6) break; t -= (bz(t, x1, x2) - x) / s; }
  if (t < 0 || t > 1 || Math.abs(bz(t, x1, x2) - x) > 1e-5) { let a = 0, b = 1; for (let i = 0; i < 40; i++) { t = (a + b) / 2; if (bz(t, x1, x2) < x) a = t; else b = t; } }
  return bz(t, y1, y2);
}
function elasticEase(easing: number, amplitude: number, period: number, f: number) {
  'worklet';
  const s = amplitude < 1 ? period / 4 : period / (2 * Math.PI) * Math.asin(1 / amplitude);
  const amp = (time: number) => { if (amplitude < 1) { const t = Math.abs(s), a = Math.abs(time); if (a < t) { const l = a / t; return amplitude * l + (1 - l); } } return amplitude; };
  if (easing === 0) { const t = f - 1; return -(amp(t) * 2 ** (10 * t) * Math.sin((-t - s) * 2 * Math.PI / period)); }
  if (easing === 2) { const t = f * 2 - 1, a = amp(t); return t < 0 ? -0.5 * a * 2 ** (10 * t) * Math.sin((-t - s) * 2 * Math.PI / period) : 0.5 * (a * 2 ** (-10 * t) * Math.sin((t - s) * 2 * Math.PI / period)) + 1; }
  return amp(f) * 2 ** (-10 * f) * Math.sin((f - s) * 2 * Math.PI / period) + 1;
}
function lerpColor(a: number, b: number, t: number) {
  'worklet';
  let r = 0;
  for (let sh = 0; sh < 32; sh += 8) { const ca = (a >>> sh) & 255, cb = (b >>> sh) & 255; r |= Math.round(ca + (cb - ca) * t) << sh; }
  return r >>> 0;
}

// ── animation ──
/** Apply `anim` at `seconds`, blended by `mix` (0..1) over what the pose already holds. */
export function applyAnimation(rig: Rig, pose: Pose, anim: Animation, seconds: number, mix = 1) {
  'worklet';
  const t = seconds * anim.fps;
  for (const ko of anim.keyed) {
    const p = pose.p[ko.objectId]; if (!p) continue;
    for (const kp of ko.props) {
      const fr = kp.frames; if (!fr.length) continue;
      let value: number;
      if (t <= fr[0].frame) value = fr[0].value;
      else if (t >= fr[fr.length - 1].frame) value = fr[fr.length - 1].value;
      else {
        let i = 0; while (fr[i + 1].frame <= t) i++;
        const a = fr[i], b = fr[i + 1];
        let f = (t - a.frame) / (b.frame - a.frame);
        if (a.interpolationType === 0) value = a.value;
        else {
          if (a.interpolationType === 2 && a.interpolatorId != null) {
            const it = rig.interpolators[a.interpolatorId];
            if (it) f = it.type === 'ElasticInterpolator' ? elasticEase(num(it.p.easingValue, 1), num(it.p.amplitude, 1), num(it.p.period, 1), f) : cubicEase(num(it.p.x1, 0.42), num(it.p.y1, 0), num(it.p.x2, 0.58), num(it.p.y2, 1), f);
          }
          value = kp.color ? lerpColor(a.value, b.value, f) : a.value + (b.value - a.value) * f;
        }
      }
      // discrete properties (all keys "hold" — e.g. a Solo's active child) snap at the blend midpoint
      let discrete = true; for (const k of fr) if (k.interpolationType !== 0) { discrete = false; break; }
      if (mix >= 1 || (discrete && mix >= 0.5)) p[kp.name] = value;
      else if (discrete) continue;
      else {
        // an unkeyed property blends from its default — 1 for scale and opacity, 0 otherwise
        const d = kp.name === 'scaleX' || kp.name === 'scaleY' || kp.name === 'opacity' ? 1 : 0, cur = num(p[kp.name], d);
        p[kp.name] = kp.color ? lerpColor(num(p[kp.name], 0), value, mix) : cur + (value - cur) * mix;
      }
    }
  }
}

// ── solve: transforms, opacity, solo visibility, skin matrices ──
export function solve(rig: Rig, pose: Pose) {
  'worklet';
  const c = rig.components, P = pose.p;
  for (const i of rig.order) {
    if (i === 0) { pose.world[0] = [1, 0, 0, 1, 0, 0]; pose.opacity[0] = 1; continue; }
    const tp = rig.transformParent[i], pw = tp == null ? ident() : pose.world[tp], po = tp == null ? 1 : pose.opacity[tp];
    if (c[i].is.transform) {
      const p = P[i];
      const x = c[i].type === 'Bone' ? num(P[c[i].parent!].length, 0) : num(p.x, 0), y = c[i].type === 'Bone' ? 0 : num(p.y, 0);
      const r = num(p.rotation, 0), sx = num(p.scaleX, 1), sy = num(p.scaleY, 1), co = Math.cos(r), si = Math.sin(r);
      pose.world[i] = mul(pw, [co * sx, si * sx, -si * sy, co * sy, x, y]);
      pose.opacity[i] = num(p.opacity, 1) * po;
    } else { pose.world[i] = pw; pose.opacity[i] = po; }
    pose.hidden[i] = false;
  }
  solveIK(rig, pose); // constraints after the forward pass, before skins read bone transforms
  for (let i = 0; i < c.length; i++) if (c[i].type === 'Solo') {
    const active = num(P[i].activeComponentId, 0);
    for (const k of rig.kids[i]) if (k !== active && c[k].is.transform) hideTree(rig, pose, k);
  }
  for (const s in rig.tendons) {
    const mats: Mat[] = [ident()];
    for (const t of rig.tendons[s]) { const tp = P[t]; mats.push(mul(pose.world[num(tp.boneId, 0)], invert([num(tp.xx, 1), num(tp.xy, 0), num(tp.yx, 0), num(tp.yy, 1), num(tp.tx, 0), num(tp.ty, 0)]))); }
    pose.boneMats[s] = mats;
  }
}
function hideTree(rig: Rig, pose: Pose, i: number) { 'worklet'; pose.hidden[i] = true; for (const k of rig.kids[i]) hideTree(rig, pose, k); }
function isHidden(rig: Rig, pose: Pose, i: number) {
  'worklet';
  for (let p: number | null = i; p != null; p = rig.components[p].parent) { if (pose.hidden[p]) return true; if (p === 0) break; }
  return false;
}

// ── geometry ──
/** World-space points of a vertex: [px, py, inX, inY, outX, outY, isCubic, radius]. */
function vertex(rig: Rig, pose: Pose, v: number, path: number): number[] {
  'worklet';
  const o = pose.p[v], T = rig.components[v].type, x = num(o.x, 0), y = num(o.y, 0);
  let ix = x, iy = y, ox = x, oy = y;
  if (T === 'CubicDetachedVertex') {
    ix = x + Math.cos(num(o.inRotation, 0)) * num(o.inDistance, 0); iy = y + Math.sin(num(o.inRotation, 0)) * num(o.inDistance, 0);
    ox = x + Math.cos(num(o.outRotation, 0)) * num(o.outDistance, 0); oy = y + Math.sin(num(o.outRotation, 0)) * num(o.outDistance, 0);
  } else if (T === 'CubicMirroredVertex') {
    const dx = Math.cos(num(o.rotation, 0)) * num(o.distance, 0), dy = Math.sin(num(o.rotation, 0)) * num(o.distance, 0);
    ix = x - dx; iy = y - dy; ox = x + dx; oy = y + dy;
  } else if (T === 'CubicAsymmetricVertex') {
    const co = Math.cos(num(o.rotation, 0)), si = Math.sin(num(o.rotation, 0));
    ix = x - co * num(o.inDistance, 0); iy = y - si * num(o.inDistance, 0); ox = x + co * num(o.outDistance, 0); oy = y + si * num(o.outDistance, 0);
  }
  const cubic = T === 'StraightVertex' ? 0 : 1, radius = num(o.radius, 0);
  const skin = rig.skinOf[path], w = rig.weightOf[v];
  if (skin != null && w != null) {
    const sp = pose.p[skin], bind: Mat = [num(sp.xx, 1), num(sp.xy, 0), num(sp.yx, 0), num(sp.yy, 1), num(sp.tx, 0), num(sp.ty, 0)];
    const mats = pose.boneMats[skin], wp = pose.p[w];
    const def = (px: number, py: number, indices: number, values: number): [number, number] => {
      const m = [0, 0, 0, 0, 0, 0];
      for (let k = 0; k < 4; k++) {
        const wt = (values >>> (k * 8)) & 255; if (!wt) continue;
        const M = mats[(indices >>> (k * 8)) & 255] || [1, 0, 0, 1, 0, 0];
        for (let j = 0; j < 6; j++) m[j] += M[j] * wt / 255;
      }
      const bx = ax(bind, px, py), by = ay(bind, px, py);
      return [m[0] * bx + m[2] * by + m[4], m[1] * bx + m[3] * by + m[5]];
    };
    const P0 = def(x, y, num(wp.indices, 1), num(wp.values, 255));
    const PI = def(ix, iy, num(wp.inIndices, 1), num(wp.inValues, 255)); // rive defaults: indices 1, values 255
    const PO = def(ox, oy, num(wp.outIndices, 1), num(wp.outValues, 255));
    return [P0[0], P0[1], PI[0], PI[1], PO[0], PO[1], cubic, radius];
  }
  const M = pose.world[path];
  return [ax(M, x, y), ay(M, x, y), ax(M, ix, iy), ay(M, ix, iy), ax(M, ox, oy), ay(M, ox, oy), cubic, radius];
}

/** rive Path::buildPath, incl. "natural rounding" corner radius. Output in view space. */
function buildPath(rig: Rig, pose: Pose, path: number, view: Mat, out: PathCmd[]) {
  'worklet';
  const vids = rig.verts[path] || [], n = vids.length;
  if (n < 2) return;
  const vs = vids.map(v => vertex(rig, pose, v, path));
  const V = (x: number, y: number) => [ax(view, x, y), ay(view, x, y)];
  const ideal = (tpx: number, tpy: number, tnx: number, tny: number, r: number) => {
    const ang = Math.abs(Math.atan2(tpx * tny - tpy * tnx, tpx * tnx + tpy * tny));
    return Math.min(r, 4 / 3 * Math.tan(Math.PI / (2 * (2 * Math.PI / ang))) * r * (ang < Math.PI / 2 ? 1 + Math.cos(ang) : 2 - Math.sin(ang)));
  };
  const corner = (i: number) => {
    const v = vs[i], pr = vs[(i - 1 + n) % n], nx = vs[(i + 1) % n];
    let tpx = (pr[6] ? pr[4] : pr[0]) - v[0], tpy = (pr[6] ? pr[5] : pr[1]) - v[1]; const lp = Math.hypot(tpx, tpy) || 1; tpx /= lp; tpy /= lp;
    let tnx = (nx[6] ? nx[2] : nx[0]) - v[0], tny = (nx[6] ? nx[3] : nx[1]) - v[1]; const ln = Math.hypot(tnx, tny) || 1; tnx /= ln; tny /= ln;
    const r = Math.min(lp / 2, ln / 2, Math.abs(v[7])), d = ideal(tpx, tpy, tnx, tny, r);
    return [v[0] + tpx * r, v[1] + tpy * r, v[0] + tpx * (r - d), v[1] + tpy * (r - d), v[0] + tnx * (r - d), v[1] + tny * (r - d), v[0] + tnx * r, v[1] + tny * r];
  };
  const M = (x: number, y: number) => { const a = V(x, y); out.push([0, a[0], a[1]]); };
  const L = (x: number, y: number) => { const a = V(x, y); out.push([1, a[0], a[1]]); };
  const C = (a: number, b: number, c2: number, d: number, e: number, f: number) => { const p1 = V(a, b), p2 = V(c2, d), p3 = V(e, f); out.push([2, p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]]); };
  let ox: number, oy: number, prevCubic: boolean, sx: number, sy: number, six: number, siy: number, startCubic: boolean;
  const f = vs[0];
  if (f[6]) { startCubic = prevCubic = true; six = f[2]; siy = f[3]; ox = f[4]; oy = f[5]; sx = f[0]; sy = f[1]; M(sx, sy); }
  else if (f[7]) { const k = corner(0); startCubic = prevCubic = false; sx = six = k[0]; sy = siy = k[1]; M(sx, sy); C(k[2], k[3], k[4], k[5], k[6], k[7]); ox = k[6]; oy = k[7]; }
  else { startCubic = prevCubic = false; sx = six = ox = f[0]; sy = siy = oy = f[1]; M(sx, sy); }
  for (let i = 1; i < n; i++) {
    const v = vs[i];
    if (v[6]) { C(ox, oy, v[2], v[3], v[0], v[1]); prevCubic = true; ox = v[4]; oy = v[5]; }
    else if (v[7]) { const k = corner(i); if (prevCubic) C(ox, oy, k[0], k[1], k[0], k[1]); else L(k[0], k[1]); C(k[2], k[3], k[4], k[5], k[6], k[7]); ox = k[6]; oy = k[7]; prevCubic = false; }
    else { if (prevCubic) C(ox, oy, v[0], v[1], v[0], v[1]); else L(v[0], v[1]); ox = v[0]; oy = v[1]; prevCubic = false; }
  }
  if (pose.p[path].isClosed) { if (prevCubic || startCubic) C(ox, oy, six, siy, sx, sy); out.push([3]); }
}

function shapePath(rig: Rig, pose: Pose, s: number, view: Mat): PathCmd[] {
  'worklet';
  const out: PathCmd[] = [];
  for (const pi of rig.paths[s] || []) if (!pose.hidden[pi]) buildPath(rig, pose, pi, view, out);
  return out;
}

const withAlpha = (argb: number, a: number) => { 'worklet'; return ((Math.round(((argb >>> 24) & 255) * Math.max(0, Math.min(1, a))) << 24) | (argb & 0xffffff)) >>> 0; };

/** Evaluate the rig into a renderer-agnostic display list. `view` maps artboard → output space. */
export function displayList(rig: Rig, pose: Pose, view: Mat = [1, 0, 0, 1, 0, 0]): DisplayList {
  'worklet';
  const c = rig.components, list: DisplayList = [];
  const viewScale = Math.sqrt(Math.abs(view[0] * view[3] - view[1] * view[2]));
  for (const s of rig.drawables) {
    if (isHidden(rig, pose, s) || (num(pose.p[s].drawableFlags, 0) & 1)) continue;
    const alpha = pose.opacity[s]; if (alpha <= 0) continue;
    const op: DrawOp = { path: shapePath(rig, pose, s, view), clips: [], paints: [] };
    for (let p: number | null = s; p != null; p = c[p].parent) {
      for (const cl of rig.clips[p] || []) {
        const cp = pose.p[cl]; if (cp.isVisible === false) continue;
        const cpath: PathCmd[] = [];
        for (const sh of rig.clipShapes[num(cp.sourceId, -1)] || []) for (const pi of rig.paths[sh] || []) buildPath(rig, pose, pi, view, cpath);
        op.clips.push({ path: cpath, evenOdd: num(cp.fillRule, 0) === 1 });
      }
      if (p === 0) break;
    }
    const W = pose.world[s], wScale = Math.sqrt(Math.abs(W[0] * W[3] - W[1] * W[2]));
    for (const pi of rig.paints[s]) {
      const paint = pose.p[pi]; if (paint.isVisible === false) continue;
      const mi = rig.mutator[pi]; let shader: Shader = { kind: 'solid', color: withAlpha(0xFF747474, alpha) };
      if (mi != null) {
        const m = pose.p[mi], T = c[mi].type;
        if (T === 'SolidColor') shader = { kind: 'solid', color: withAlpha(num(m.colorValue, 0xFF747474), (((num(m.colorValue, 0xFF747474) >>> 24) & 255) / 255) * alpha) };
        else {
          const gx0 = ax(W, num(m.startX, 0), num(m.startY, 0)), gy0 = ay(W, num(m.startX, 0), num(m.startY, 0)), gx1 = ax(W, num(m.endX, 0), num(m.endY, 0)), gy1 = ay(W, num(m.endX, 0), num(m.endY, 0));
          const x0 = ax(view, gx0, gy0), y0 = ay(view, gx0, gy0), x1 = ax(view, gx1, gy1), y1 = ay(view, gx1, gy1);
          const stops = (rig.stops[mi] || []).map(k => ({ pos: Math.min(1, Math.max(0, num(pose.p[k].position, 0))), col: num(pose.p[k].colorValue, 0xFFFFFFFF) })).sort((a, b) => a.pos - b.pos);
          const ga = alpha * num(m.opacity, 1);
          const colors = stops.map(st => withAlpha(st.col, (((st.col >>> 24) & 255) / 255) * ga)), positions = stops.map(st => st.pos);
          shader = T === 'RadialGradient' ? { kind: 'radial', cx: x0, cy: y0, r: Math.hypot(x1 - x0, y1 - y0), colors, positions } : { kind: 'linear', x0, y0, x1, y1, colors, positions };
        }
      }
      if (c[pi].type === 'Fill') op.paints.push({ style: 'fill', shader, evenOdd: num(paint.fillRule, 0) === 1 });
      else op.paints.push({ style: 'stroke', shader, width: num(paint.thickness, 1) * (paint.transformAffectsStroke === false ? 1 : wScale) * viewScale, cap: num(paint.cap, 0), join: num(paint.join, 0) });
    }
    list.push(op);
  }
  return list;
}
