var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// twist-rig/src/math.ts
var ident, mul, invert;
var init_math = __esm({
  "twist-rig/src/math.ts"() {
    "use strict";
    ident = () => {
      "worklet";
      return [1, 0, 0, 1, 0, 0];
    };
    mul = (a, b) => {
      "worklet";
      return [
        a[0] * b[0] + a[2] * b[1],
        a[1] * b[0] + a[3] * b[1],
        a[0] * b[2] + a[2] * b[3],
        a[1] * b[2] + a[3] * b[3],
        a[0] * b[4] + a[2] * b[5] + a[4],
        a[1] * b[4] + a[3] * b[5] + a[5]
      ];
    };
    invert = (m) => {
      "worklet";
      const det = m[0] * m[3] - m[1] * m[2];
      if (!det) return [1, 0, 0, 1, 0, 0];
      const d = 1 / det;
      return [m[3] * d, -m[1] * d, -m[2] * d, m[0] * d, (m[2] * m[5] - m[3] * m[4]) * d, (m[1] * m[4] - m[0] * m[5]) * d];
    };
  }
});

// twist-rig/src/ik.ts
function localMat(rig, pose, i) {
  "worklet";
  const c = rig.components[i], p = pose.p[i];
  const x = c.type === "Bone" ? num(pose.p[c.parent].length, 0) : num(p.x, 0), y = c.type === "Bone" ? 0 : num(p.y, 0);
  const r = num(p.rotation, 0), sx = num(p.scaleX, 1), sy = num(p.scaleY, 1), co = Math.cos(r), si = Math.sin(r);
  return [co * sx, si * sx, -si * sy, co * sy, x, y];
}
function recomputeFrom(rig, pose, roots) {
  "worklet";
  const dirty = new Array(rig.components.length).fill(false);
  for (const r of roots) dirty[r] = true;
  for (const i of rig.order) {
    const tp = rig.transformParent[i];
    if (!dirty[i] && !(tp != null && dirty[tp]) && !(rig.components[i].type === "Bone" && dirty[rig.components[i].parent])) continue;
    dirty[i] = true;
    const pw = tp == null ? ident() : pose.world[tp];
    pose.world[i] = rig.components[i].is.transform ? mul(pw, localMat(rig, pose, i)) : pw;
  }
}
function solveIK(rig, pose) {
  "worklet";
  const c = rig.components;
  for (let k = 0; k < c.length; k++) {
    if (c[k].type !== "IKConstraint") continue;
    const P = pose.p[k], tip = c[k].parent, target = num(P.targetId, -1);
    if (target < 0) continue;
    const strength = num(P.strength, 1), W = pose.world, tw = W[target];
    if (num(P.parentBoneCount, 1) === 0) {
      const tp = rig.transformParent[tip], iw2 = invert(W[tp]);
      const px = W[tip][4], py = W[tip][5], dx = tw[4] - px, dy = tw[5] - py;
      const lx = iw2[0] * dx + iw2[2] * dy, ly = iw2[1] * dx + iw2[3] * dy;
      pose.p[tip].rotation = angleLerp(num(pose.p[tip].rotation, 0), Math.atan2(ly, lx), strength);
      recomputeFrom(rig, pose, [tip]);
      continue;
    }
    const b2 = tip, b1 = c[b2].parent;
    const iw = invert(W[rig.transformParent[b1]]);
    const tr = (m, x, y) => [iw[0] * x + iw[2] * y + iw[4], iw[1] * x + iw[3] * y + iw[5]];
    const pA = tr(W[b1], W[b1][4], W[b1][5]), pC = tr(W[b2], W[b2][4], W[b2][5]);
    const L2 = num(pose.p[b2].length, 0), tipW = [W[b2][0] * L2 + W[b2][4], W[b2][1] * L2 + W[b2][5]];
    const pB = tr(W[b2], tipW[0], tipW[1]), pT = tr(tw, tw[4], tw[5]);
    const a = Math.hypot(pB[0] - pC[0], pB[1] - pC[1]), b = Math.hypot(pC[0] - pA[0], pC[1] - pA[1]);
    const cvx = pT[0] - pA[0], cvy = pT[1] - pA[1], cc = Math.hypot(cvx, cvy);
    const A = Math.acos(Math.max(-1, Math.min(1, (-a * a + b * b + cc * cc) / (2 * b * cc || 1))));
    const C2 = Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - cc * cc) / (2 * a * b || 1))));
    const base = Math.atan2(cvy, cvx), inv = P.invertDirection === true;
    const r1 = inv ? base - A : A + base, r2 = inv ? -C2 + Math.PI : C2 - Math.PI;
    pose.p[b1].rotation = angleLerp(num(pose.p[b1].rotation, 0), r1, strength);
    pose.p[b2].rotation = angleLerp(num(pose.p[b2].rotation, 0), r2, strength);
    recomputeFrom(rig, pose, [b1]);
  }
}
var num, angleLerp;
var init_ik = __esm({
  "twist-rig/src/ik.ts"() {
    "use strict";
    init_math();
    num = (v, d) => {
      "worklet";
      return typeof v === "number" ? v : d;
    };
    angleLerp = (a, b, t) => {
      "worklet";
      let d = (b - a) % (2 * Math.PI);
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      return a + d * t;
    };
  }
});

// twist-rig/src/core.ts
function compileRig(model) {
  const c = model.components, n = c.length;
  const kids = c.map(() => []);
  c.forEach((o, i) => {
    if (i && o.parent != null && kids[o.parent]) kids[o.parent].push(i);
  });
  const transformParent = c.map((o, i) => {
    for (let p = o.parent; p != null; p = c[p].parent) if (c[p].is.transform || p === 0) return p;
    return i === 0 ? null : 0;
  });
  const order = [];
  const seen = new Array(n).fill(false);
  const visit = (i) => {
    if (seen[i]) return;
    seen[i] = true;
    const tp = transformParent[i];
    if (tp != null) visit(tp);
    if (c[i].type === "Bone" && c[i].parent != null) visit(c[i].parent);
    order.push(i);
  };
  for (let i = 0; i < n; i++) visit(i);
  const of = (i, re) => kids[i].filter((j) => re.test(c[j].type));
  const rig = { ...model, kids, transformParent, order, drawables: [], paths: {}, paints: {}, verts: {}, skinOf: {}, tendons: {}, weightOf: {}, mutator: {}, stops: {}, clips: {}, clipShapes: {}, base: c.map((o) => ({ ...o.p })) };
  c.forEach((o, i) => {
    if (o.type === "Shape") {
      rig.paths[i] = kids[i].filter((j) => c[j].is.path);
      rig.paints[i] = of(i, /^(Fill|Stroke)$/);
    }
    if (o.is.path) {
      rig.verts[i] = kids[i].filter((j) => c[j].is.vertex);
      const s = of(i, /^Skin$/)[0];
      if (s != null) rig.skinOf[i] = s;
    }
    if (o.type === "Skin") rig.tendons[i] = of(i, /^Tendon$/);
    if (o.is.vertex) {
      const w = of(i, /Weight$/)[0];
      if (w != null) rig.weightOf[i] = w;
    }
    if (/^(Fill|Stroke)$/.test(o.type)) {
      const m = of(i, /^(SolidColor|LinearGradient|RadialGradient)$/)[0];
      if (m != null) rig.mutator[i] = m;
    }
    if (/Gradient$/.test(o.type)) rig.stops[i] = of(i, /^GradientStop$/);
    if (o.type === "ClippingShape") {
      (rig.clips[o.parent] ||= []).push(i);
      const src = num2(o.p.sourceId, -1), shapes = [];
      const walk = (k) => {
        if (c[k].type === "Shape") shapes.push(k);
        kids[k].forEach(walk);
      };
      if (src >= 0) walk(src);
      rig.clipShapes[src] = shapes;
    }
  });
  rig.drawables = c.map((_, i) => i).filter((i) => c[i].type === "Shape").reverse();
  return rig;
}
function createPose(rig) {
  "worklet";
  return { p: rig.base.map((b) => ({ ...b })), world: rig.components.map(() => ident()), opacity: rig.components.map(() => 1), hidden: rig.components.map(() => false), boneMats: {} };
}
function solve(rig, pose) {
  "worklet";
  const c = rig.components, P = pose.p;
  for (const i of rig.order) {
    if (i === 0) {
      pose.world[0] = [1, 0, 0, 1, 0, 0];
      pose.opacity[0] = 1;
      continue;
    }
    const tp = rig.transformParent[i], pw = tp == null ? ident() : pose.world[tp], po = tp == null ? 1 : pose.opacity[tp];
    if (c[i].is.transform) {
      const p = P[i];
      const x = c[i].type === "Bone" ? num2(P[c[i].parent].length, 0) : num2(p.x, 0), y = c[i].type === "Bone" ? 0 : num2(p.y, 0);
      const r = num2(p.rotation, 0), sx = num2(p.scaleX, 1), sy = num2(p.scaleY, 1), co = Math.cos(r), si = Math.sin(r);
      pose.world[i] = mul(pw, [co * sx, si * sx, -si * sy, co * sy, x, y]);
      pose.opacity[i] = num2(p.opacity, 1) * po;
    } else {
      pose.world[i] = pw;
      pose.opacity[i] = po;
    }
    pose.hidden[i] = false;
  }
  solveIK(rig, pose);
  for (let i = 0; i < c.length; i++) if (c[i].type === "Solo") {
    const active = num2(P[i].activeComponentId, 0);
    for (const k of rig.kids[i]) if (k !== active && c[k].is.transform) hideTree(rig, pose, k);
  }
  for (const s in rig.tendons) {
    const mats = [ident()];
    for (const t of rig.tendons[s]) {
      const tp = P[t];
      mats.push(mul(pose.world[num2(tp.boneId, 0)], invert([num2(tp.xx, 1), num2(tp.xy, 0), num2(tp.yx, 0), num2(tp.yy, 1), num2(tp.tx, 0), num2(tp.ty, 0)])));
    }
    pose.boneMats[s] = mats;
  }
}
function hideTree(rig, pose, i) {
  "worklet";
  pose.hidden[i] = true;
  for (const k of rig.kids[i]) hideTree(rig, pose, k);
}
var num2;
var init_core = __esm({
  "twist-rig/src/core.ts"() {
    "use strict";
    init_math();
    init_ik();
    num2 = (v, d) => {
      "worklet";
      return typeof v === "number" ? v : d;
    };
  }
});

// twist-rig/src/builder.ts
var T, N, RigBuilder;
var init_builder = __esm({
  "twist-rig/src/builder.ts"() {
    "use strict";
    init_core();
    T = { transform: true, path: false, vertex: false, drawable: false };
    N = { transform: false, path: false, vertex: false, drawable: false };
    RigBuilder = class {
      constructor(width, height) {
        this.width = width;
        this.height = height;
        this.c = [];
        this.animations = [];
        this.interpolators = {};
        this.skins = [];
        this.c.push({ type: "Artboard", parent: null, p: { width, height }, is: N });
      }
      add(type, parent, p, is = N) {
        this.c.push({ type, parent, p, is });
        return this.c.length - 1;
      }
      node(parent, p = {}) {
        return this.add("Node", parent, p, T);
      }
      solo(parent, p = {}) {
        return this.add("Solo", parent, p, T);
      }
      rootBone(parent, p) {
        return this.add("RootBone", parent, p, T);
      }
      bone(parent, p) {
        return this.add("Bone", parent, p, T);
      }
      /** World matrix of component `i` in the bind pose built so far. */
      worldOf(i) {
        const rig = compileRig({ width: this.width, height: this.height, components: this.c, animations: [], interpolators: {} });
        const pose = createPose(rig);
        solve(rig, pose);
        return pose.world[i];
      }
      /** RootBone from world point a to world point b, parented to any transform. */
      rootBoneAt(parent, a, b) {
        const pw = this.worldOf(parent), det = pw[0] * pw[3] - pw[1] * pw[2];
        const inv = [pw[3] / det, -pw[1] / det, -pw[2] / det, pw[0] / det];
        const lx = inv[0] * (a[0] - pw[4]) + inv[2] * (a[1] - pw[5]), ly = inv[1] * (a[0] - pw[4]) + inv[3] * (a[1] - pw[5]);
        const dx = inv[0] * (b[0] - a[0]) + inv[2] * (b[1] - a[1]), dy = inv[1] * (b[0] - a[0]) + inv[3] * (b[1] - a[1]);
        return this.rootBone(parent, { x: lx, y: ly, rotation: Math.atan2(dy, dx), length: Math.hypot(dx, dy) });
      }
      /** Child Bone continuing from the parent bone's tip to world point b. */
      boneTo(parent, b) {
        const pw = this.worldOf(parent), L = this.c[parent].p.length;
        const tx = pw[0] * L + pw[4], ty = pw[1] * L + pw[5];
        const det = pw[0] * pw[3] - pw[1] * pw[2], dx = b[0] - tx, dy = b[1] - ty;
        const lx = (pw[3] * dx - pw[2] * dy) / det, ly = (-pw[1] * dx + pw[0] * dy) / det;
        return this.bone(parent, { rotation: Math.atan2(ly, lx), length: Math.hypot(dx, dy) });
      }
      /** Pose solver: aim each bone of a chain at a world target, setting rotation and a length scale (scaleX) so its
       *  tip lands on the target — how a rigger makes the same limb short or long. Returns { bone: { rotation, scaleX } }
       *  without changing the bind pose. */
      aim(chain, targets) {
        const saved = chain.map((i) => ({ ...this.c[i].p }));
        const out = {};
        chain.forEach((bone, k) => {
          const pw = this.worldOf(this.c[bone].parent), bw0 = this.worldOf(bone);
          const sx = bw0[4], sy = bw0[5], [tx, ty] = targets[k], dx = tx - sx, dy = ty - sy;
          const det = pw[0] * pw[3] - pw[1] * pw[2];
          const lx = (pw[3] * dx - pw[2] * dy) / det, ly = (-pw[1] * dx + pw[0] * dy) / det;
          this.c[bone].p.rotation = Math.atan2(ly, lx);
          this.c[bone].p.scaleX = 1;
          const bw = this.worldOf(bone), L = this.c[bone].p.length;
          const reach = Math.hypot(bw[0] * L, bw[1] * L) || 1;
          this.c[bone].p.scaleX = Math.hypot(dx, dy) / reach;
          out[bone] = { rotation: this.c[bone].p.rotation, scaleX: this.c[bone].p.scaleX };
        });
        chain.forEach((i, k) => {
          this.c[i].p = saved[k];
        });
        return out;
      }
      shape(parent, p = {}) {
        return this.add("Shape", parent, p, { ...T, drawable: true });
      }
      /** Closed or open path. Vertices: [x, y] (straight) or { x, y, in, out } (cubic, absolute handle points). */
      path(shape, vs, p = { isClosed: true }) {
        const path = this.add("PointsPath", shape, { isClosed: true, ...p }, { ...T, path: true });
        for (const v of vs) {
          if (Array.isArray(v)) {
            this.add("StraightVertex", path, { x: v[0], y: v[1] }, { ...N, vertex: true });
            continue;
          }
          if (!v.in && !v.out) {
            this.add("StraightVertex", path, { x: v.x, y: v.y, radius: v.radius }, { ...N, vertex: true });
            continue;
          }
          const i = v.in ?? [v.x, v.y], o = v.out ?? [v.x, v.y];
          this.add("CubicDetachedVertex", path, {
            x: v.x,
            y: v.y,
            inRotation: Math.atan2(i[1] - v.y, i[0] - v.x),
            inDistance: Math.hypot(i[0] - v.x, i[1] - v.y),
            outRotation: Math.atan2(o[1] - v.y, o[0] - v.x),
            outDistance: Math.hypot(o[0] - v.x, o[1] - v.y)
          }, { ...N, vertex: true });
        }
        return path;
      }
      fill(shape, argb, p = {}) {
        const f = this.add("Fill", shape, p);
        this.add("SolidColor", f, { colorValue: argb >>> 0 });
        return f;
      }
      stroke(shape, argb, thickness, p = {}) {
        const s = this.add("Stroke", shape, { thickness, cap: 1, join: 1, ...p });
        this.add("SolidColor", s, { colorValue: argb >>> 0 });
        return s;
      }
      clip(parent, source, p = {}) {
        return this.add("ClippingShape", parent, { sourceId: source, ...p });
      }
      ik(tipBone, target, p = {}) {
        return this.add("IKConstraint", tipBone, { targetId: target, parentBoneCount: 1, ...p });
      }
      /** Bind `path` to `bones`; weights computed at build() from distance to each bone segment. */
      skin(path, bones, opts = {}) {
        const skin = this.add("Skin", path, {});
        for (const b of bones) this.add("Tendon", skin, { boneId: b });
        this.skins.push({ path, bones, skin, falloff: opts.falloff ?? 4, maxBones: opts.maxBones ?? 2 });
        return skin;
      }
      cubicEase(x1, y1, x2, y2) {
        const i = this.add("CubicEaseInterpolator", 0, { x1, y1, x2, y2 });
        this.interpolators[i] = { type: "CubicEaseInterpolator", p: { x1, y1, x2, y2 } };
        return i;
      }
      /** keys: { [componentIndex]: { [prop]: [[frame, value, ease?], …] } }  ease: interpolator id | 'linear' | 'hold' */
      animation(name, fps, duration, keys, loop = 0, colorProps = ["colorValue"]) {
        const keyed = Object.entries(keys).map(([obj, props]) => ({ objectId: +obj, props: Object.entries(props).map(([name2, frames]) => ({
          name: name2,
          color: colorProps.includes(name2),
          frames: frames.map(([frame, value, e]) => ({ frame, value, interpolationType: e === "hold" ? 0 : e === "linear" || e === void 0 ? 1 : 2, interpolatorId: typeof e === "number" ? e : void 0 }))
        })) }));
        this.animations.push({ name, fps, duration, loop, keyed });
      }
      build() {
        const model = { width: this.width, height: this.height, components: this.c, animations: this.animations, interpolators: this.interpolators };
        if (!this.skins.length) return model;
        const rig = compileRig(model), pose = createPose(rig);
        solve(rig, pose);
        const W = pose.world;
        for (const s of this.skins) {
          const pw = W[s.path];
          Object.assign(this.c[s.skin].p, { xx: pw[0], xy: pw[1], yx: pw[2], yy: pw[3], tx: pw[4], ty: pw[5] });
          const tendons = rig.tendons[s.skin];
          tendons.forEach((t, k) => {
            const bw = W[s.bones[k]];
            Object.assign(this.c[t].p, { xx: bw[0], xy: bw[1], yx: bw[2], yy: bw[3], tx: bw[4], ty: bw[5] });
          });
          const segs = s.bones.map((b) => {
            const m = W[b], L = this.c[b].p.length ?? 0;
            return [m[4], m[5], m[0] * L + m[4], m[1] * L + m[5]];
          });
          const weigh = (x, y) => {
            const d = segs.map(([x0, y0, x1, y1]) => {
              const vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy || 1;
              const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / l2));
              return Math.hypot(x - x0 - vx * t, y - y0 - vy * t);
            });
            const ranked = d.map((v, i) => ({ i, w: 1 / Math.pow(v + 1e-3, s.falloff) })).sort((a, b) => b.w - a.w).slice(0, s.maxBones);
            const sum = ranked.reduce((a, r) => a + r.w, 0);
            let bytes = ranked.map((r) => Math.round(255 * r.w / sum));
            bytes[0] += 255 - bytes.reduce((a, v) => a + v, 0);
            let indices = 0, values = 0;
            ranked.forEach((r, k) => {
              if (!bytes[k]) return;
              indices |= r.i + 1 << k * 8;
              values |= bytes[k] << k * 8;
            });
            return { indices: indices >>> 0, values: values >>> 0 };
          };
          const wp = (x, y) => [pw[0] * x + pw[2] * y + pw[4], pw[1] * x + pw[3] * y + pw[5]];
          for (const v of rig.verts[s.path]) {
            const p = this.c[v].p, x = p.x, y = p.y;
            const [X, Y] = wp(x, y), w = weigh(X, Y);
            if (this.c[v].type === "CubicDetachedVertex") {
              const ix = x + Math.cos(p.inRotation) * p.inDistance, iy = y + Math.sin(p.inRotation) * p.inDistance;
              const ox = x + Math.cos(p.outRotation) * p.outDistance, oy = y + Math.sin(p.outRotation) * p.outDistance;
              const wi = weigh(...wp(ix, iy)), wo = weigh(...wp(ox, oy));
              this.add("CubicWeight", v, { values: w.values, indices: w.indices, inValues: wi.values, inIndices: wi.indices, outValues: wo.values, outIndices: wo.indices });
            } else this.add("Weight", v, { values: w.values, indices: w.indices });
          }
        }
        return { ...model, components: this.c };
      }
    };
  }
});

// rig2/mascot2.ts
function smooth(pts, k = 1 / 6, closed = true) {
  const n = pts.length;
  return pts.map((p, i) => {
    if (p[2] === "c" || !closed && (i === 0 || i === n - 1)) return { x: p[0], y: p[1], in: [p[0], p[1]], out: [p[0], p[1]] };
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const tx = (b[0] - a[0]) * k, ty = (b[1] - a[1]) * k;
    return { x: p[0], y: p[1], in: [p[0] - tx, p[1] - ty], out: [p[0] + tx, p[1] + ty] };
  });
}
function ellipse(cx, cy, rx, ry) {
  return [
    { x: cx, y: cy - ry, in: [cx - rx * K, cy - ry], out: [cx + rx * K, cy - ry] },
    { x: cx + rx, y: cy, in: [cx + rx, cy - ry * K], out: [cx + rx, cy + ry * K] },
    { x: cx, y: cy + ry, in: [cx + rx * K, cy + ry], out: [cx - rx * K, cy + ry] },
    { x: cx - rx, y: cy, in: [cx - rx, cy + ry * K], out: [cx - rx, cy - ry * K] }
  ];
}
function capsule(x0, y0, x1, y1, r0, r1 = r0) {
  const L = Math.hypot(x1 - x0, y1 - y0), dx = (x1 - x0) / L, dy = (y1 - y0) / L, nx = -dy, ny = dx;
  const P = (x, y, ix, iy, ox, oy) => ({ x, y, in: [ix, iy], out: [ox, oy] });
  const a = [x0 - nx * r0, y0 - ny * r0], tip0 = [x0 - dx * r0, y0 - dy * r0], b = [x0 + nx * r0, y0 + ny * r0];
  const c = [x1 + nx * r1, y1 + ny * r1], tip1 = [x1 + dx * r1, y1 + dy * r1], d = [x1 - nx * r1, y1 - ny * r1];
  const k0 = K * r0, k1 = K * r1;
  return [
    P(a[0], a[1], a[0] + dx * k0, a[1] + dy * k0, a[0] - dx * k0, a[1] - dy * k0),
    P(tip0[0], tip0[1], tip0[0] - nx * k0, tip0[1] - ny * k0, tip0[0] + nx * k0, tip0[1] + ny * k0),
    P(b[0], b[1], b[0] - dx * k0, b[1] - dy * k0, b[0] + dx * k0, b[1] + dy * k0),
    P(c[0], c[1], c[0] - dx * k1, c[1] - dy * k1, c[0] + dx * k1, c[1] + dy * k1),
    P(tip1[0], tip1[1], tip1[0] + nx * k1, tip1[1] + ny * k1, tip1[0] - nx * k1, tip1[1] - ny * k1),
    P(d[0], d[1], d[0] + dx * k1, d[1] + dy * k1, d[0] - dx * k1, d[1] - dy * k1)
  ];
}
function buildMascot2() {
  const b = new RigBuilder(1254, 1254);
  const root = b.node(0, {});
  const torso = b.rootBoneAt(root, [630, 840], [630, 580]);
  const head = b.boneTo(torso, [630, 300]);
  const bones = { torso, head };
  bones.earL = b.rootBoneAt(head, [480, 250], [390, 114]);
  bones.earR = b.rootBoneAt(head, [780, 250], [870, 114]);
  bones.eyeL = b.rootBoneAt(head, [520, 343], [520, 237]);
  bones.eyeR = b.rootBoneAt(head, [740, 343], [740, 237]);
  bones.armL_up = b.rootBoneAt(torso, [500, 598], [500, 712]);
  bones.armL_lo = b.boneTo(bones.armL_up, [500, 818]);
  bones.handL = b.boneTo(bones.armL_lo, [500, 908]);
  bones.armR_up = b.rootBoneAt(torso, [760, 598], [760, 712]);
  bones.armR_lo = b.boneTo(bones.armR_up, [760, 818]);
  bones.handR = b.boneTo(bones.armR_lo, [760, 908]);
  bones.legL = b.rootBoneAt(torso, [550, 790], [550, 1004]);
  bones.legR = b.rootBoneAt(torso, [710, 790], [710, 1004]);
  bones.capeL_1 = b.rootBoneAt(torso, [512, 590], [365, 668]);
  bones.capeL_2 = b.boneTo(bones.capeL_1, [220, 746]);
  bones.capeR_1 = b.rootBoneAt(torso, [748, 590], [895, 668]);
  bones.capeR_2 = b.boneTo(bones.capeR_1, [1040, 746]);
  const mouthSolo = b.solo(root);
  const mouthNodes = { open: b.node(mouthSolo), mid: b.node(mouthSolo), closed: b.node(mouthSolo) };
  b.c[mouthSolo].p.activeComponentId = mouthNodes.open;
  const SH = { x: 630, y: 1162 };
  const fxShadow = b.node(0, { x: SH.x, y: SH.y }), fxShadowArt = b.node(fxShadow, { x: -SH.x, y: -SH.y });
  const items = [];
  const add = (it) => items.push(it);
  const piece = (v, fill, bonesOf, stroke = OUT) => {
    add({ v, stroke, bones: bonesOf });
    add({ v, fill, bones: bonesOf });
  };
  const L = (s) => bones[s];
  add({ v: ART.shadow, fill: C.shadow, parent: fxShadowArt });
  for (const side of ["L", "R"]) {
    const m = side === "R" ? mirror : (x) => x, cb = [L(`cape${side}_1`), L(`cape${side}_2`)];
    piece(m(ART.cape), C.cape, cb, 30);
    add({ v: m(ART.capeFold1), fill: C.capeDk, bones: cb });
    add({ v: m(ART.capeFold2), fill: C.capeMid, bones: cb });
  }
  add({ v: ART.leg, stroke: OUT, bones: [L("legL")] });
  add({ v: mirror(ART.leg), stroke: OUT, bones: [L("legR")] });
  add({ v: ART.torso, stroke: OUT, bones: [torso] });
  add({ v: ART.upperArm, stroke: OUT, bones: [L("armL_up")] });
  add({ v: mirror(ART.upperArm), stroke: OUT, bones: [L("armR_up")] });
  add({ v: ART.leg, fill: C.shade, bones: [L("legL")] });
  add({ v: mirror(ART.leg), fill: C.shade, bones: [L("legR")] });
  add({ v: ART.legHi, fill: C.skin, bones: [L("legL")] });
  add({ v: mirror(ART.legHi), fill: C.skin, bones: [L("legR")] });
  for (const t of ART.toes) {
    add({ v: t, stroke: 7, open: true, bones: [L("legL")] });
    add({ v: mirror(t), stroke: 7, open: true, bones: [L("legR")] });
  }
  add({ v: ART.torso, fill: C.shade, bones: [torso] });
  add({ v: ART.belly, fill: C.skin, bones: [torso] });
  add({ v: ART.upperArm, fill: C.skin, bones: [L("armL_up")] });
  add({ v: mirror(ART.upperArm), fill: C.skin, bones: [L("armR_up")] });
  add({ v: ART.crease, stroke: 8, open: true, bones: [torso] });
  for (const side of ["R", "L"]) {
    const m = side === "R" ? mirror : (x) => x, up = [L(`arm${side}_up`)], lo = [L(`arm${side}_lo`)], hand = [L(`hand${side}`)];
    add({ v: m(ART.foreArm), stroke: OUT, bones: lo });
    add({ v: m(ART.paw), stroke: OUT, bones: hand });
    add({ v: m(ART.foreArm), fill: C.skin, bones: lo });
    add({ v: m(ART.paw), fill: C.skin, bones: hand });
    void up;
    for (const cl of ART.claws) add({ v: m(cl), stroke: 7, open: true, bones: hand });
  }
  for (const side of ["L", "R"]) {
    const m = side === "R" ? mirror : (x) => x, eb = [L(`ear${side}`)];
    piece(m(ART.ear), C.skin, eb);
    add({ v: m(ART.earIn), fill: C.shade, bones: eb });
  }
  piece(ART.head, C.skin, [head]);
  add({ v: ART.headShade, fill: C.shade, bones: [head] });
  for (const side of ["L", "R"]) {
    const m = side === "R" ? mirror : (x) => x, eye = [L(`eye${side}`)];
    add({ v: m(ART.blush), fill: C.blush, bones: [head] });
    add({ v: m(ART.eye), fill: C.ink, bones: eye });
    add({ v: side === "L" ? ART.eyeHi : shiftX(ART.eyeHi, 220), fill: C.white, bones: eye });
  }
  add({ v: ART.nose, fill: C.ink, bones: [head] });
  add({ v: ART.noseHi, fill: C.noseHi, bones: [head] });
  const teeth = (parent) => {
    for (const side of ["L", "R"]) {
      const m = side === "R" ? (v) => shiftX(v, 188) : (x) => x;
      add({ v: m(ART.tooth), fill: C.tooth, bones: [head], parent });
      add({ v: m(ART.toothSh), fill: C.toothSh, bones: [head], parent });
    }
  };
  add({ v: ART.mouth, fill: C.ink, bones: [head], parent: mouthNodes.open });
  add({ v: ART.tongue, fill: C.tongueDk, bones: [head], parent: mouthNodes.open });
  add({ v: ART.tongueHi, fill: C.tongue, bones: [head], parent: mouthNodes.open });
  teeth(mouthNodes.open);
  add({ v: squashY(ART.mouth, 0.52), fill: C.ink, bones: [head], parent: mouthNodes.mid });
  add({ v: shiftY(squashY(ART.tongue, 0.6, 543), -84), fill: C.tongue, bones: [head], parent: mouthNodes.mid });
  teeth(mouthNodes.mid);
  for (const side of ["L", "R"]) {
    const m = side === "R" ? (v) => shiftX(v, 188) : (x) => x;
    add({ v: m(ART.tooth), stroke: 9, bones: [head], parent: mouthNodes.closed });
    add({ v: m(ART.tooth), fill: C.tooth, bones: [head], parent: mouthNodes.closed });
    add({ v: m(ART.toothSh), fill: C.toothSh, bones: [head], parent: mouthNodes.closed });
  }
  add({ v: ART.lip, fill: C.ink, bones: [head], parent: mouthNodes.closed });
  piece(ART.collar, C.cape, [torso], 22);
  add({ v: ART.collarFold, fill: C.capeMid, bones: [torso] });
  piece(ART.medal, C.gold, [torso], 18);
  add({ v: ART.medalRing, fill: C.goldDk, bones: [torso] });
  add({ v: ART.medalIn, fill: C.gold, bones: [torso] });
  add({ v: ART.medalHi, fill: C.goldHi, bones: [torso] });
  for (const it of [...items].reverse()) {
    const sh = b.shape(it.parent ?? root);
    const contours = Array.isArray(it.v[0]) ? it.v : [it.v];
    for (const v of contours) {
      const p = b.path(sh, v, { isClosed: !it.open });
      if (it.bones) b.skin(p, it.bones);
    }
    if (it.stroke) b.stroke(sh, C.ink, it.stroke);
    if (it.fill != null) b.fill(sh, it.fill);
  }
  const aim = (pairs) => b.aim(pairs.map((p) => bones[p[0]]), pairs.map((p) => p[1]));
  const FLY = {
    ...aim([["armL_up", [412, 506]], ["armL_lo", [338, 418]], ["handL", [300, 356]]]),
    // fist to the sky, clear of the head
    ...aim([["armR_up", [792, 700]], ["armR_lo", [808, 772]], ["handR", [816, 850]]]),
    // paw relaxed at the hip
    ...aim([["legL", [566, 930]]]),
    ...aim([["legR", [692, 1e3]]])
    // one knee lifted
  };
  const STAND = {
    ...aim([["armL_up", [446, 700]], ["armL_lo", [462, 660]], ["handL", [466, 720]]]),
    // paws up at the chest
    ...aim([["armR_up", [814, 700]], ["armR_lo", [798, 660]], ["handR", [794, 720]]]),
    ...aim([["legL", [530, 1004]]]),
    ...aim([["legR", [730, 1004]]]),
    // feet planted apart
    ...aim([["capeL_1", [452, 712]], ["capeL_2", [420, 884]]]),
    ...aim([["capeR_1", [808, 712]], ["capeR_2", [840, 884]]])
    // cape hangs
  };
  for (const [k, v] of Object.entries({ [torso]: 0.93, [head]: 1 / 0.93, [bones.legL]: STAND[bones.legL].scaleX * 0.88, [bones.legR]: STAND[bones.legR].scaleX * 0.88 }))
    STAND[+k] = { rotation: STAND[+k]?.rotation ?? b.c[+k].p.rotation, scaleX: v };
  const TUCK = { ...aim([["legL", [575, 950]]]), ...aim([["legR", [690, 960]]]) };
  const easeIO = b.cubicEase(0.42, 0, 0.58, 1), easeOut = b.cubicEase(0.16, 1, 0.3, 1), easeIn = b.cubicEase(0.6, 0, 0.84, 0);
  const base = (i, k) => b.c[i].p[k] ?? (k.startsWith("scale") ? 1 : 0);
  const R = Math.PI / 180;
  const keyPoses = (frames) => {
    const ids = /* @__PURE__ */ new Set();
    for (const [, p] of frames) if (p) for (const k in p) ids.add(+k);
    return Object.fromEntries([...ids].map((i) => [i, {
      // unwrap each key next to the rest angle so blends never swing the long way round the ±180° seam
      rotation: frames.map(([f, p, e]) => {
        const r0 = base(i, "rotation"), r = p?.[i]?.rotation ?? r0;
        return [f, r0 + Math.atan2(Math.sin(r - r0), Math.cos(r - r0)), e ?? easeIO];
      }),
      scaleX: frames.map(([f, p, e]) => [f, p?.[i]?.scaleX ?? 1, e ?? easeIO])
    }]));
  };
  const deg = (bone, fr) => ({ rotation: fr.map(([f, d]) => [f, base(bones[bone], "rotation") + d * R, easeIO]) });
  const solo = (fr) => ({ [mouthSolo]: { activeComponentId: fr.map(([f, m]) => [f, mouthNodes[m], "hold"]) } });
  const shadow = (fr) => ({ [fxShadow]: { scaleX: fr.map(([f, k]) => [f, k, easeIO]), scaleY: fr.map(([f, k]) => [f, k, easeIO]), opacity: fr.map(([f, k]) => [f, 0.35 + 0.65 * k, easeIO]) } });
  const GROUND = 150, AIR = -70;
  b.animation("stand", 60, 120, {
    // breathing idle
    ...keyPoses([[0, STAND], [120, STAND]]),
    [torso]: { scaleX: [[0, 0.93], [60, 0.95], [120, 0.93]], scaleY: [[0, 1], [60, 0.99], [120, 1]], rotation: [[0, base(torso, "rotation")], [120, base(torso, "rotation")]] },
    [head]: { ...deg("head", [[0, 0], [60, 1.5], [120, 0]]), scaleX: [[0, 1 / 0.93], [120, 1 / 0.93]] },
    [root]: { y: [[0, GROUND], [120, GROUND]] },
    ...shadow([[0, 1], [120, 1]]),
    ...solo([[0, "closed"]])
  }, 1);
  b.animation("launch", 60, 42, {
    // anticipation → take-off → settle
    ...keyPoses([[0, STAND], [12, STAND, easeIn], [22, { ...FLY, ...TUCK }, easeOut], [42, FLY]]),
    [torso]: { scaleX: [[0, 0.93], [12, 0.84, easeIn], [22, 1.1, easeOut], [34, 0.97], [42, 1]], scaleY: [[0, 1], [12, 1.1, easeIn], [22, 0.93, easeOut], [42, 1]], rotation: [[0, base(torso, "rotation")], [42, base(torso, "rotation")]] },
    [head]: { scaleX: [[0, 1 / 0.93], [12, 1 / 0.84, easeIn], [22, 1 / 1.1, easeOut], [34, 1 / 0.97], [42, 1]] },
    [root]: { y: [[0, GROUND], [12, GROUND + 26, easeIn], [26, AIR - 50, easeOut], [42, AIR, easeIO]] },
    ...shadow([[0, 1], [12, 1.06], [26, 0.6], [42, 0.62]]),
    ...solo([[0, "closed"], [10, "mid"], [18, "open"]])
  });
  b.animation("fly", 60, 120, {
    // hover loop
    ...keyPoses([[0, FLY], [120, FLY]]),
    [root]: { y: [[0, AIR], [60, AIR - 18], [120, AIR]] },
    [bones.capeL_2]: deg("capeL_2", [[0, -4], [30, 7], [90, -7], [120, -4]]),
    [bones.capeR_2]: deg("capeR_2", [[0, 4], [30, -7], [90, 7], [120, 4]]),
    [bones.capeL_1]: deg("capeL_1", [[0, 0], [60, 4], [120, 0]]),
    [bones.capeR_1]: deg("capeR_1", [[0, 0], [60, -4], [120, 0]]),
    [bones.earL]: deg("earL", [[0, 0], [70, -6], [120, 0]]),
    [bones.earR]: deg("earR", [[0, 0], [70, 6], [120, 0]]),
    [head]: deg("head", [[0, 0], [60, -2], [120, 0]]),
    ...shadow([[0, 0.62], [60, 0.55], [120, 0.62]]),
    ...solo([[0, "open"]])
  }, 1);
  b.animation("blink", 60, 180, {
    [bones.eyeL]: { scaleX: [[0, 1], [164, 1], [168, 0.08, "linear"], [174, 1, easeOut], [180, 1]] },
    [bones.eyeR]: { scaleX: [[0, 1], [164, 1], [168, 0.08, "linear"], [174, 1, easeOut], [180, 1]] }
  }, 1);
  const stateMachine = {
    name: "mascot",
    inputs: [{ name: "launch", type: "trigger" }, { name: "land", type: "trigger" }],
    layers: [
      {
        name: "body",
        entry: "stand",
        states: [{ name: "stand", animation: "stand" }, { name: "launch", animation: "launch" }, { name: "fly", animation: "fly" }],
        transitions: [{ from: "stand", to: "launch", duration: 0.08, conditions: [{ input: "launch" }] }, { from: "launch", to: "fly", duration: 0.2, exitTime: 1 }, { from: "fly", to: "stand", duration: 0.45, conditions: [{ input: "land" }] }]
      },
      { name: "face", entry: "blink", states: [{ name: "blink", animation: "blink" }], transitions: [] }
    ]
  };
  return { model: b.build(), bones, nodes: { root, mouthSolo, fxShadow, ...mouthNodes }, stateMachine };
}
function shiftX(vs, dx) {
  return vs.map((v) => {
    const o = v;
    return { x: o.x + dx, y: o.y, in: [o.in[0] + dx, o.in[1]], out: [o.out[0] + dx, o.out[1]] };
  });
}
var C, OUT, AXIS, K, mirror, ART, squashY, shiftY;
var init_mascot2 = __esm({
  "rig2/mascot2.ts"() {
    init_builder();
    C = {
      ink: 4280681812,
      skin: 4292185332,
      shade: 4290212585,
      blush: 4293702904,
      noseHi: 4287393960,
      tongue: 4294870215,
      tongueDk: 4293747622,
      tooth: 4294901502,
      toothSh: 4292993249,
      cape: 4294649899,
      capeMid: 4293272361,
      capeDk: 4290976291,
      gold: 4294888753,
      goldDk: 4294154256,
      goldHi: 4294832560,
      shadow: 4293319675,
      white: 4294967295
    };
    OUT = 36;
    AXIS = 630;
    K = 0.5523;
    mirror = (vs) => vs.map((v) => {
      const o = v;
      return { x: 2 * AXIS - o.x, y: o.y, in: [2 * AXIS - o.in[0], o.in[1]], out: [2 * AXIS - o.out[0], o.out[1]] };
    });
    ART = {
      shadow: ellipse(630, 1162, 140, 24),
      cape: smooth([[512, 590, "c"], [450, 620], [365, 668], [285, 712], [220, 746, "c"], [254, 776], [292, 806], [330, 838], [372, 862], [420, 878], [470, 888], [550, 886], [580, 700]]),
      capeFold1: smooth([[448, 642], [470, 710], [480, 800], [472, 884, "c"], [430, 872, "c"], [436, 770], [424, 694]]),
      capeFold2: smooth([[342, 694], [364, 750], [366, 846, "c"], [330, 834, "c"], [332, 760]]),
      leg: smooth([[494, 760], [606, 760], [606, 870], [610, 945], [602, 986], [574, 1006], [526, 1006], [498, 986], [490, 945], [494, 870]]),
      legHi: smooth([[548, 800], [588, 820], [592, 900], [580, 960], [554, 968], [540, 900]]),
      toes: [smooth([[532, 1004], [534, 990], [538, 978]], 1 / 6, false), smooth([[568, 1004], [566, 990], [562, 978]], 1 / 6, false)],
      torso: smooth([[630, 560], [722, 566], [774, 602], [796, 662], [800, 742], [790, 802], [760, 842], [700, 860], [630, 864], [560, 860], [500, 842], [470, 802], [460, 742], [464, 662], [486, 602], [538, 566]]),
      belly: smooth([[630, 598], [712, 612], [752, 680], [744, 768], [696, 818], [630, 830], [564, 818], [516, 768], [508, 680], [548, 612]]),
      crease: smooth([[592, 840], [630, 852], [668, 840]], 1 / 6, false),
      upperArm: capsule(500, 598, 500, 712, 34, 32),
      foreArm: capsule(500, 712, 500, 818, 32, 30),
      paw: smooth([[450, 838], [500, 818], [550, 838], [562, 872], [544, 908], [500, 920], [456, 908], [438, 872]]),
      claws: [smooth([[480, 920], [482, 905], [486, 890]], 1 / 6, false), smooth([[520, 920], [518, 905], [514, 890]], 1 / 6, false)],
      ear: smooth([[548, 204], [508, 176], [462, 156], [406, 134, "c"], [398, 182], [406, 236], [430, 282], [476, 304]]),
      earIn: smooth([[512, 198], [466, 170], [420, 152, "c"], [420, 200], [436, 246], [472, 272]]),
      head: smooth([[560, 168], [588, 156], [598, 136, "c"], [618, 160], [652, 132, "c"], [672, 162], [704, 168], [772, 184], [822, 224], [850, 290], [862, 370], [860, 450], [844, 510], [854, 530, "c"], [822, 540], [798, 556], [738, 572], [630, 582], [522, 572], [462, 556], [438, 540], [406, 530, "c"], [416, 510], [400, 450], [398, 370], [410, 290], [438, 224], [488, 184]]),
      headShade: smooth([[796, 222], [842, 300], [856, 400], [848, 488], [816, 544], [786, 560], [818, 484], [828, 400], [818, 312]]),
      eye: ellipse(520, 290, 42, 53),
      eyeHi: ellipse(535, 272, 11, 11),
      blush: ellipse(503, 350, 32, 10),
      nose: ellipse(628, 332, 62, 24),
      noseHi: ellipse(628, 324, 20, 7),
      mouth: smooth([[472, 388], [520, 375], [632, 371], [745, 375], [798, 390], [785, 452], [740, 512], [632, 545], [528, 514], [484, 456]]),
      tongue: smooth([[566, 506], [592, 478], [632, 486], [672, 478], [698, 506], [688, 533], [632, 543], [576, 533]]),
      tongueHi: smooth([[606, 506], [632, 500], [658, 506], [664, 524], [632, 534], [600, 524]]),
      tooth: smooth([[512, 375, "c"], [561, 375, "c"], [561, 398], [553, 413], [520, 413], [512, 398]]),
      toothSh: smooth([[514, 377, "c"], [527, 377, "c"], [527, 411], [519, 410], [514, 399]]),
      lip: smooth([[486, 364, "c"], [508, 376], [632, 381], [756, 376], [778, 364, "c"], [756, 370], [632, 375], [508, 370]]),
      collar: smooth([[466, 552, "c"], [550, 580], [630, 592], [710, 580], [794, 552, "c"], [800, 572], [790, 588], [710, 610], [630, 622], [550, 610], [470, 588], [460, 572]]),
      collarFold: smooth([[540, 600], [630, 612], [720, 600], [716, 608], [630, 618], [544, 608]]),
      medal: ellipse(628, 602, 30, 30),
      medalRing: ellipse(628, 602, 19, 19),
      medalIn: ellipse(628, 602, 12, 12),
      medalHi: ellipse(617, 588, 8, 4)
    };
    squashY = (vs, k, top = 371) => vs.map((v) => {
      const o = v;
      const f = (y) => top + (y - top) * k;
      return { x: o.x, y: f(o.y), in: [o.in[0], f(o.in[1])], out: [o.out[0], f(o.out[1])] };
    });
    shiftY = (vs, dy) => vs.map((v) => {
      const o = v;
      return { x: o.x, y: o.y + dy, in: [o.in[0], o.in[1] + dy], out: [o.out[0], o.out[1] + dy] };
    });
  }
});

// rig2/.entry.ts
import fs from "node:fs";
var require_entry = __commonJS({
  "rig2/.entry.ts"() {
    init_mascot2();
    fs.writeFileSync(process.argv[2], JSON.stringify(buildMascot2()));
  }
});
export default require_entry();
