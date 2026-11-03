// Rig authoring in code (JS thread). Produces a RigModel; computes bind poses and automatic skin weights.
import type { RigModel, Component, Animation, KeyedProperty, Interpolator } from './types';
import { compileRig, createPose, solve } from './core';

type Props = Record<string, number | string | boolean | undefined>;
export type V = [number, number] | { x: number; y: number; in?: [number, number]; out?: [number, number]; radius?: number };

const T = { transform: true, path: false, vertex: false, drawable: false };
const N = { transform: false, path: false, vertex: false, drawable: false };

export class RigBuilder {
  c: Component[] = [];
  animations: Animation[] = [];
  interpolators: Record<number, Interpolator> = {};
  private skins: { path: number; bones: number[]; skin: number; falloff: number; maxBones: number }[] = [];
  constructor(public width: number, public height: number) {
    this.c.push({ type: 'Artboard', parent: null, p: { width, height }, is: N });
  }
  private add(type: string, parent: number, p: Props, is = N) { this.c.push({ type, parent, p, is }); return this.c.length - 1; }

  node(parent: number, p: Props = {}) { return this.add('Node', parent, p, T); }
  solo(parent: number, p: Props = {}) { return this.add('Solo', parent, p, T); }
  rootBone(parent: number, p: Props) { return this.add('RootBone', parent, p, T); }
  bone(parent: number, p: Props) { return this.add('Bone', parent, p, T); }
  /** World matrix of component `i` in the bind pose built so far. */
  worldOf(i: number) {
    const rig = compileRig({ width: this.width, height: this.height, components: this.c, animations: [], interpolators: {} });
    const pose = createPose(rig); solve(rig, pose); return pose.world[i];
  }
  /** RootBone from world point a to world point b, parented to any transform. */
  rootBoneAt(parent: number, a: [number, number], b: [number, number]) {
    const pw = this.worldOf(parent), det = pw[0] * pw[3] - pw[1] * pw[2];
    const inv = [pw[3] / det, -pw[1] / det, -pw[2] / det, pw[0] / det];
    const lx = inv[0] * (a[0] - pw[4]) + inv[2] * (a[1] - pw[5]), ly = inv[1] * (a[0] - pw[4]) + inv[3] * (a[1] - pw[5]);
    const dx = inv[0] * (b[0] - a[0]) + inv[2] * (b[1] - a[1]), dy = inv[1] * (b[0] - a[0]) + inv[3] * (b[1] - a[1]);
    return this.rootBone(parent, { x: lx, y: ly, rotation: Math.atan2(dy, dx), length: Math.hypot(dx, dy) });
  }
  /** Child Bone continuing from the parent bone's tip to world point b. */
  boneTo(parent: number, b: [number, number]) {
    const pw = this.worldOf(parent), L = this.c[parent].p.length as number;
    const tx = pw[0] * L + pw[4], ty = pw[1] * L + pw[5];
    const det = pw[0] * pw[3] - pw[1] * pw[2], dx = b[0] - tx, dy = b[1] - ty;
    const lx = (pw[3] * dx - pw[2] * dy) / det, ly = (-pw[1] * dx + pw[0] * dy) / det;
    return this.bone(parent, { rotation: Math.atan2(ly, lx), length: Math.hypot(dx, dy) });
  }
  /** Pose solver: aim each bone of a chain at a world target, setting rotation and a length scale (scaleX) so its
   *  tip lands on the target — how a rigger makes the same limb short or long. Returns { bone: { rotation, scaleX } }
   *  without changing the bind pose. */
  aim(chain: number[], targets: [number, number][]) {
    const saved = chain.map(i => ({ ...this.c[i].p }));
    const out: Record<number, { rotation: number; scaleX: number }> = {};
    chain.forEach((bone, k) => {
      const pw = this.worldOf(this.c[bone].parent!), bw0 = this.worldOf(bone);
      const sx = bw0[4], sy = bw0[5], [tx, ty] = targets[k], dx = tx - sx, dy = ty - sy;
      const det = pw[0] * pw[3] - pw[1] * pw[2];
      const lx = (pw[3] * dx - pw[2] * dy) / det, ly = (-pw[1] * dx + pw[0] * dy) / det;
      this.c[bone].p.rotation = Math.atan2(ly, lx); this.c[bone].p.scaleX = 1;
      const bw = this.worldOf(bone), L = this.c[bone].p.length as number;
      const reach = Math.hypot(bw[0] * L, bw[1] * L) || 1;
      this.c[bone].p.scaleX = Math.hypot(dx, dy) / reach;
      out[bone] = { rotation: this.c[bone].p.rotation as number, scaleX: this.c[bone].p.scaleX as number };
    });
    chain.forEach((i, k) => { this.c[i].p = saved[k]; });
    return out;
  }
  shape(parent: number, p: Props = {}) { return this.add('Shape', parent, p, { ...T, drawable: true }); }
  /** Closed or open path. Vertices: [x, y] (straight) or { x, y, in, out } (cubic, absolute handle points). */
  path(shape: number, vs: V[], p: Props = { isClosed: true }) {
    const path = this.add('PointsPath', shape, { isClosed: true, ...p }, { ...T, path: true });
    for (const v of vs) {
      if (Array.isArray(v)) { this.add('StraightVertex', path, { x: v[0], y: v[1] }, { ...N, vertex: true }); continue; }
      if (!v.in && !v.out) { this.add('StraightVertex', path, { x: v.x, y: v.y, radius: v.radius }, { ...N, vertex: true }); continue; }
      const i = v.in ?? [v.x, v.y], o = v.out ?? [v.x, v.y];
      this.add('CubicDetachedVertex', path, { x: v.x, y: v.y,
        inRotation: Math.atan2(i[1] - v.y, i[0] - v.x), inDistance: Math.hypot(i[0] - v.x, i[1] - v.y),
        outRotation: Math.atan2(o[1] - v.y, o[0] - v.x), outDistance: Math.hypot(o[0] - v.x, o[1] - v.y) }, { ...N, vertex: true });
    }
    return path;
  }
  fill(shape: number, argb: number, p: Props = {}) { const f = this.add('Fill', shape, p); this.add('SolidColor', f, { colorValue: argb >>> 0 }); return f; }
  stroke(shape: number, argb: number, thickness: number, p: Props = {}) { const s = this.add('Stroke', shape, { thickness, cap: 1, join: 1, ...p }); this.add('SolidColor', s, { colorValue: argb >>> 0 }); return s; }
  clip(parent: number, source: number, p: Props = {}) { return this.add('ClippingShape', parent, { sourceId: source, ...p }); }
  ik(tipBone: number, target: number, p: Props = {}) { return this.add('IKConstraint', tipBone, { targetId: target, parentBoneCount: 1, ...p }); }
  /** Bind `path` to `bones`; weights computed at build() from distance to each bone segment. */
  skin(path: number, bones: number[], opts: { falloff?: number; maxBones?: number } = {}) {
    const skin = this.add('Skin', path, {});
    for (const b of bones) this.add('Tendon', skin, { boneId: b });
    this.skins.push({ path, bones, skin, falloff: opts.falloff ?? 4, maxBones: opts.maxBones ?? 2 });
    return skin;
  }
  cubicEase(x1: number, y1: number, x2: number, y2: number) { const i = this.add('CubicEaseInterpolator', 0, { x1, y1, x2, y2 }); this.interpolators[i] = { type: 'CubicEaseInterpolator', p: { x1, y1, x2, y2 } }; return i; }
  /** keys: { [componentIndex]: { [prop]: [[frame, value, ease?], …] } }  ease: interpolator id | 'linear' | 'hold' */
  animation(name: string, fps: number, duration: number, keys: Record<number, Record<string, [number, number, (number | 'linear' | 'hold')?][]>>, loop = 0, colorProps: string[] = ['colorValue']) {
    const keyed = Object.entries(keys).map(([obj, props]) => ({ objectId: +obj, props: Object.entries(props).map(([name, frames]): KeyedProperty => ({
      name, color: colorProps.includes(name),
      frames: frames.map(([frame, value, e]) => ({ frame, value, interpolationType: e === 'hold' ? 0 : e === 'linear' || e === undefined ? 1 : 2, interpolatorId: typeof e === 'number' ? e : undefined })),
    })) }));
    this.animations.push({ name, fps, duration, loop, keyed });
  }

  build(): RigModel {
    const model: RigModel = { width: this.width, height: this.height, components: this.c, animations: this.animations, interpolators: this.interpolators };
    if (!this.skins.length) return model;
    // bind pose = authored values
    const rig = compileRig(model), pose = createPose(rig); solve(rig, pose);
    const W = pose.world;
    for (const s of this.skins) {
      const pw = W[s.path];
      Object.assign(this.c[s.skin].p, { xx: pw[0], xy: pw[1], yx: pw[2], yy: pw[3], tx: pw[4], ty: pw[5] });
      const tendons = rig.tendons[s.skin];
      tendons.forEach((t, k) => { const bw = W[s.bones[k]]; Object.assign(this.c[t].p, { xx: bw[0], xy: bw[1], yx: bw[2], yy: bw[3], tx: bw[4], ty: bw[5] }); });
      const segs = s.bones.map(b => { const m = W[b], L = (this.c[b].p.length as number) ?? 0; return [m[4], m[5], m[0] * L + m[4], m[1] * L + m[5]]; });
      const weigh = (x: number, y: number) => {
        const d = segs.map(([x0, y0, x1, y1]) => { const vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy || 1; const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / l2)); return Math.hypot(x - x0 - vx * t, y - y0 - vy * t); });
        const ranked = d.map((v, i) => ({ i, w: 1 / Math.pow(v + 1e-3, s.falloff) })).sort((a, b) => b.w - a.w).slice(0, s.maxBones);
        const sum = ranked.reduce((a, r) => a + r.w, 0);
        let bytes = ranked.map(r => Math.round(255 * r.w / sum)); bytes[0] += 255 - bytes.reduce((a, v) => a + v, 0);
        let indices = 0, values = 0;
        ranked.forEach((r, k) => { if (!bytes[k]) return; indices |= (r.i + 1) << (k * 8); values |= bytes[k] << (k * 8); });
        return { indices: indices >>> 0, values: values >>> 0 };
      };
      const wp = (x: number, y: number) => [pw[0] * x + pw[2] * y + pw[4], pw[1] * x + pw[3] * y + pw[5]];
      for (const v of rig.verts[s.path]) {
        const p = this.c[v].p, x = p.x as number, y = p.y as number;
        const [X, Y] = wp(x, y), w = weigh(X, Y);
        if (this.c[v].type === 'CubicDetachedVertex') {
          const ix = x + Math.cos(p.inRotation as number) * (p.inDistance as number), iy = y + Math.sin(p.inRotation as number) * (p.inDistance as number);
          const ox = x + Math.cos(p.outRotation as number) * (p.outDistance as number), oy = y + Math.sin(p.outRotation as number) * (p.outDistance as number);
          const wi = weigh(...(wp(ix, iy) as [number, number])), wo = weigh(...(wp(ox, oy) as [number, number]));
          this.add('CubicWeight', v, { values: w.values, indices: w.indices, inValues: wi.values, inIndices: wi.indices, outValues: wo.values, outIndices: wo.indices });
        } else this.add('Weight', v, { values: w.values, indices: w.indices });
      }
    }
    return { ...model, components: this.c };
  }
}
