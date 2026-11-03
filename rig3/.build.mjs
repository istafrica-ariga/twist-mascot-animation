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
    const C = Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - cc * cc) / (2 * a * b || 1))));
    const base = Math.atan2(cvy, cvx), inv = P.invertDirection === true;
    const r1 = inv ? base - A : A + base, r2 = inv ? -C + Math.PI : C - Math.PI;
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
        const path2 = this.add("PointsPath", shape, { isClosed: true, ...p }, { ...T, path: true });
        for (const v of vs) {
          if (Array.isArray(v)) {
            this.add("StraightVertex", path2, { x: v[0], y: v[1] }, { ...N, vertex: true });
            continue;
          }
          if (!v.in && !v.out) {
            this.add("StraightVertex", path2, { x: v.x, y: v.y, radius: v.radius }, { ...N, vertex: true });
            continue;
          }
          const i = v.in ?? [v.x, v.y], o = v.out ?? [v.x, v.y];
          this.add("CubicDetachedVertex", path2, {
            x: v.x,
            y: v.y,
            inRotation: Math.atan2(i[1] - v.y, i[0] - v.x),
            inDistance: Math.hypot(i[0] - v.x, i[1] - v.y),
            outRotation: Math.atan2(o[1] - v.y, o[0] - v.x),
            outDistance: Math.hypot(o[0] - v.x, o[1] - v.y)
          }, { ...N, vertex: true });
        }
        return path2;
      }
      fill(shape, argb2, p = {}) {
        const f = this.add("Fill", shape, p);
        this.add("SolidColor", f, { colorValue: argb2 >>> 0 });
        return f;
      }
      stroke(shape, argb2, thickness, p = {}) {
        const s = this.add("Stroke", shape, { thickness, cap: 1, join: 1, ...p });
        this.add("SolidColor", s, { colorValue: argb2 >>> 0 });
        return s;
      }
      clip(parent, source, p = {}) {
        return this.add("ClippingShape", parent, { sourceId: source, ...p });
      }
      ik(tipBone, target, p = {}) {
        return this.add("IKConstraint", tipBone, { targetId: target, parentBoneCount: 1, ...p });
      }
      /** Bind `path` to `bones`; weights computed at build() from distance to each bone segment. */
      skin(path2, bones, opts = {}) {
        const skin = this.add("Skin", path2, {});
        for (const b of bones) this.add("Tendon", skin, { boneId: b });
        this.skins.push({ path: path2, bones, skin, falloff: opts.falloff ?? 4, maxBones: opts.maxBones ?? 2 });
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

// rig3/mascot3.ts
import fs from "node:fs";
import path from "node:path";
function parseD(d) {
  const tok = d.match(/[MmLlHhVvCcSsQqZz]|-?(?:\d*\.\d+|\d+\.?)(?:e-?\d+)?/g) ?? [];
  const out = [];
  let cur = [];
  let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0, lc = null;
  const num3 = () => +tok[i++];
  const close = () => {
    if (cur.length > 1) {
      const a = cur[0], b = cur[cur.length - 1];
      if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-3) {
        a.in = b.in;
        cur.pop();
      }
    }
    if (cur.length > 2) out.push(cur);
    cur = [];
  };
  const seg = (c1, c2, px, py) => {
    cur[cur.length - 1].out = c1;
    cur.push({ x: px, y: py, in: c2, out: [px, py] });
    x = px;
    y = py;
  };
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case "M": {
        close();
        x = ox + num3();
        y = oy + num3();
        sx = x;
        sy = y;
        cur.push({ x, y, in: [x, y], out: [x, y] });
        cmd = rel ? "l" : "L";
        lc = null;
        break;
      }
      case "L": {
        const px = ox + num3(), py = oy + num3();
        seg([x, y], [px, py], px, py);
        lc = null;
        break;
      }
      case "H": {
        const px = ox + num3();
        seg([x, y], [px, y], px, y);
        lc = null;
        break;
      }
      case "V": {
        const py = oy + num3();
        seg([x, y], [x, py], x, py);
        lc = null;
        break;
      }
      case "C": {
        const c1 = [ox + num3(), oy + num3()], c2 = [ox + num3(), oy + num3()];
        seg(c1, c2, ox + num3(), oy + num3());
        lc = c2;
        break;
      }
      case "S": {
        const c1 = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y];
        const c2 = [ox + num3(), oy + num3()];
        seg(c1, c2, ox + num3(), oy + num3());
        lc = c2;
        break;
      }
      case "Q": {
        const q = [ox + num3(), oy + num3()], px = ox + num3(), py = oy + num3();
        seg([x + 2 / 3 * (q[0] - x), y + 2 / 3 * (q[1] - y)], [px + 2 / 3 * (q[0] - px), py + 2 / 3 * (q[1] - py)], px, py);
        lc = null;
        break;
      }
      case "Z": {
        if (Math.hypot(x - sx, y - sy) > 1e-3) seg([x, y], [sx, sy], sx, sy);
        close();
        x = sx;
        y = sy;
        lc = null;
        break;
      }
      default:
        i++;
    }
  }
  close();
  return out;
}
function svgGroup(svg, id) {
  const g = svg.match(new RegExp(`<g id="${id}"[^>]*>([\\s\\S]*?)</g>`));
  if (!g) throw new Error("no group " + id);
  return [...g[1].matchAll(/<path\b([^>]*)\/>/g)].map((m) => {
    const a = (k) => m[1].match(new RegExp(`\\s${k}="([^"]*)"`))?.[1];
    const fill = a("fill"), stroke = a("stroke");
    return { d: a("d"), fill: fill && fill !== "none" ? argb(fill) : null, stroke: stroke ? { color: argb(stroke), width: +(a("stroke-width") ?? 1) } : void 0 };
  });
}
function bbox(els) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const e of els) for (const c of parseD(e.d)) for (const v of c) {
    const p = v;
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
function buildMascot3() {
  const parts = read("out/mascot_parts.svg"), variants = read("out/mascot_variants.svg");
  const P = (id) => svgGroup(parts, id), Vr = (id) => svgGroup(variants, id);
  const body = JSON.parse(read("rig3/stand_body.json"));
  const G = 975;
  const NECK = [628, 540];
  const AXIS = 628;
  const mirror = (els) => els.map((e) => ({ ...e, d: mirrorD(e.d, AXIS) }));
  const piv = (id, at, els = P(id)) => {
    const b2 = bbox(els);
    return at === "center" ? [b2.cx, b2.cy] : at === "base" ? [b2.cx, b2.y1 - (b2.y1 - b2.y0) * 0.15] : at === "topR" ? [b2.x1 - 20, b2.y0 + 20] : at === "topL" ? [b2.x0 + 20, b2.y0 + 20] : [b2.cx, b2.y0 + 25];
  };
  const eyes = (sfx) => [node("eyeL" + sfx, [paths(P("eye_L"))], piv("eye_L", "center")), node("eyeR" + sfx, [paths(P("eye_R"))], piv("eye_R", "center"))];
  const face = (sfx, mouth2) => [...eyes(sfx), paths(P("blush_L")), paths(P("blush_R")), paths(P("nose")), mouth2];
  const ears = (sfx) => [node("earL" + sfx, [paths(P("ear_L"))], piv("ear_L", "base")), node("earR" + sfx, [paths(P("ear_R"))], piv("ear_R", "base"))];
  const standBody = body.layers.map((l) => ({ d: l.contours.map((c) => `M${c[0].x},${c[0].y}` + c.map((p, i) => {
    const q = c[(i + 1) % c.length];
    return `C${p.out[0]},${p.out[1]} ${q.in[0]},${q.in[1]} ${q.x},${q.y}`;
  }).join("") + "Z").join(""), fill: argb(l.color) }));
  const KEEP = [[0, 0], [1254, 0], [1254, 1254], [480, 1254], [480, 320], [0, 320]];
  const stand = node("stand", [
    paths(standBody),
    paths(P("collar")),
    node("headS", [...ears("S"), paths(mirror(P("head"))), node("headKeep", [paths(P("head"))], void 0, { clip: KEEP }), ...face("S", paths(Vr("mouth_closed")))], NECK),
    paths(P("medal"))
  ]);
  const fly = node("fly", [
    node("speed", [paths(P("fx_speedlines"))], [628, 1e3]),
    node("capeL", [paths(P("cape_L"))], piv("cape_L", "topR")),
    node("capeR", [paths(P("cape_R"))], piv("cape_R", "topL")),
    paths(P("cape_mid")),
    node("legL", [paths(P("leg_L"))], piv("leg_L", "top")),
    node("legR", [paths(P("leg_R"))], piv("leg_R", "top")),
    paths(P("torso")),
    node("armR", [paths(P("arm_R_upper")), paths(P("hand_R"))], [770, 610]),
    paths(P("collar")),
    node("fist", [paths(P("arm_L")), paths(P("hand_L"))], [480, 575]),
    node("headF", [...ears("F"), paths(P("head")), ...face("F", node("mouthSolo", [node("mouthOpen", [paths(P("mouth"))]), node("mouthMid", [paths(Vr("mouth_mid"))])], void 0, { solo: true }))], NECK),
    paths(P("medal"))
  ]);
  const shadowB = bbox(P("fx_shadow"));
  const scene = node("scene", [
    node("shadow", [paths(P("fx_shadow"))], [shadowB.cx, shadowB.cy], { props: { x: AXIS, y: G + 8 } }),
    node("root", [node("poseSolo", [stand, fly], void 0, { solo: true })], [AXIS, G])
  ]);
  const b = new RigBuilder(1254, 1254);
  const ids = {};
  const emit = (it, parent) => {
    if (it.kind === "paths") {
      for (const e of [...it.els].reverse()) {
        const s = b.shape(parent);
        for (const c of parseD(e.d)) b.path(s, c);
        if (e.stroke) b.stroke(s, e.stroke.color, e.stroke.width);
        if (e.fill != null) b.fill(s, e.fill);
      }
      return;
    }
    const [px, py] = it.pivot ?? [0, 0];
    const outer = it.solo ? b.solo(parent, it.props ?? {}) : b.node(parent, { x: px, y: py, ...it.props ?? {} });
    ids[it.name] = outer;
    const inner = it.pivot ? b.node(outer, { x: -px, y: -py }) : outer;
    if (it.clip) {
      const cs = b.shape(inner);
      b.path(cs, it.clip);
      b.clip(inner, cs);
    }
    for (const k of [...it.kids].reverse()) emit(k, inner);
    if (it.solo) b.c[outer].p.activeComponentId = ids[it.kids[0].name];
  };
  emit(scene, 0);
  b.c[ids.poseSolo].p.activeComponentId = ids.stand;
  b.c[ids.mouthSolo].p.activeComponentId = ids.mouthOpen;
  const R = Math.PI / 180;
  const easeIO = b.cubicEase(0.42, 0, 0.58, 1), easeIn = b.cubicEase(0.5, 0, 0.9, 0.5), easeOut = b.cubicEase(0.1, 0.6, 0.4, 1);
  const n = ids, AIR = -120;
  const rot = (fr) => ({ rotation: fr.map(([f, d, e]) => [f, d * R, e ?? easeIO]) });
  const pose = (fr) => ({ [n.poseSolo]: { activeComponentId: fr.map(([f, k]) => [f, n[k], "hold"]) } });
  const mouth = (fr) => ({ [n.mouthSolo]: { activeComponentId: fr.map(([f, k]) => [f, n[k], "hold"]) } });
  const shadow = (fr) => ({ [n.shadow]: { scaleX: fr.map(([f, k, e]) => [f, k, e ?? easeIO]), scaleY: fr.map(([f, k, e]) => [f, k, e ?? easeIO]), opacity: fr.map(([f, k, e]) => [f, 0.3 + 0.7 * k, e ?? easeIO]) } });
  const body3 = (fr) => ({ [n.root]: {
    // [frame, y, scaleX, scaleY]
    y: fr.map(([f, y, , , e]) => [f, G + y, e ?? easeIO]),
    scaleX: fr.map(([f, , sx, , e]) => [f, sx, e ?? easeIO]),
    scaleY: fr.map(([f, , , sy, e]) => [f, sy, e ?? easeIO])
  } });
  b.animation("stand", 60, 150, {
    // breathing idle, head sways, ears twitch
    ...pose([[0, "stand"]]),
    ...body3([[0, 0, 1, 1], [75, 0, 0.992, 1.014], [150, 0, 1, 1]]),
    ...shadow([[0, 1], [75, 0.99], [150, 1]]),
    [n.headS]: rot([[0, 0], [75, 1.6], [150, 0]]),
    [n.earLS]: rot([[0, 0], [96, 0], [102, -7], [110, 0], [150, 0]]),
    [n.earRS]: rot([[0, 0], [100, 0], [106, 7], [114, 0], [150, 0]])
  }, 1);
  b.animation("launch", 60, 60, {
    // crouch → swap at the stretch → rise → settle into hover
    ...pose([[0, "stand"], [15, "fly"]]),
    ...mouth([[0, "mouthMid"], [24, "mouthOpen"]]),
    ...body3([[0, 0, 1, 1], [14, 0, 1.1, 0.86, easeIn], [15, -30, 0.9, 1.14, "linear"], [32, AIR - 34, 0.98, 1.03, easeOut], [46, AIR + 6, 1.01, 0.99], [60, AIR, 1, 1]]),
    ...shadow([[0, 1], [14, 1.08, easeIn], [32, 0.58, easeOut], [60, 0.62]]),
    [n.headS]: rot([[0, 0], [14, -2]]),
    [n.capeL]: rot([[0, 0], [15, -12, "linear"], [32, 6, easeOut], [48, -3], [60, 0]]),
    [n.capeR]: rot([[0, 0], [15, 12, "linear"], [32, -6, easeOut], [48, 3], [60, 0]]),
    [n.fist]: rot([[0, 0], [15, 10, "linear"], [34, -4, easeOut], [60, 0]]),
    [n.legL]: rot([[0, 0], [15, 10, "linear"], [36, -3, easeOut], [60, 0]]),
    [n.legR]: rot([[0, 0], [15, -8, "linear"], [36, 3, easeOut], [60, 0]]),
    [n.speed]: { opacity: [[0, 0], [15, 0, "hold"], [30, 1], [60, 1]] }
  });
  b.animation("fly", 60, 120, {
    // hover loop: bob, cape flutter, fist pump, dangling legs
    ...pose([[0, "fly"]]),
    ...mouth([[0, "mouthOpen"]]),
    ...body3([[0, AIR, 1, 1], [60, AIR - 18, 1, 1], [120, AIR, 1, 1]]),
    ...shadow([[0, 0.62], [60, 0.55], [120, 0.62]]),
    [n.capeL]: rot([[0, 0], [30, 4], [90, -4], [120, 0]]),
    [n.capeR]: rot([[0, 0], [30, -4], [90, 4], [120, 0]]),
    [n.fist]: rot([[0, 0], [60, -3], [120, 0]]),
    [n.armR]: rot([[0, 0], [60, 3], [120, 0]]),
    [n.legL]: rot([[0, 0], [40, 4], [100, -2], [120, 0]]),
    [n.legR]: rot([[0, 0], [50, -4], [110, 2], [120, 0]]),
    [n.headF]: rot([[0, 0], [60, -1.5], [120, 0]]),
    [n.earLF]: rot([[0, 0], [70, -5], [120, 0]]),
    [n.earRF]: rot([[0, 0], [70, 5], [120, 0]]),
    [n.speed]: { opacity: [[0, 1], [30, 0.55], [60, 1], [90, 0.55], [120, 1]], y: [[0, 1e3], [60, 1012], [120, 1e3]] }
  }, 1);
  b.animation("land", 60, 54, {
    // drop → swap at contact → squash → settle
    ...pose([[0, "fly"], [16, "stand"]]),
    ...mouth([[0, "mouthOpen"], [8, "mouthMid"]]),
    ...body3([[0, AIR, 1, 1], [15, -6, 0.95, 1.07, easeIn], [16, 0, 1.12, 0.86, "linear"], [30, 0, 0.98, 1.03, easeOut], [42, 0, 1.005, 0.995], [54, 0, 1, 1]]),
    ...shadow([[0, 0.62], [16, 1.06, easeIn], [30, 1], [54, 1]]),
    [n.capeL]: rot([[0, 0], [15, 5, easeIn]]),
    [n.capeR]: rot([[0, 0], [15, -5, easeIn]]),
    [n.legL]: rot([[0, 0], [15, -6, easeIn]]),
    [n.legR]: rot([[0, 0], [15, 6, easeIn]]),
    [n.headS]: rot([[16, 2.5], [34, -1], [54, 0]]),
    [n.speed]: { opacity: [[0, 1], [10, 0]] }
  });
  const blink = (eye) => ({ scaleY: [[0, 1], [170, 1], [174, 0.1, "linear"], [180, 1, easeOut], [240, 1]] });
  b.animation("blink", 60, 240, { [n.eyeLS]: blink(0), [n.eyeRS]: blink(0), [n.eyeLF]: blink(0), [n.eyeRF]: blink(0) }, 1);
  const stateMachine = {
    name: "mascot",
    inputs: [{ name: "launch", type: "trigger" }, { name: "land", type: "trigger" }],
    layers: [
      {
        name: "body",
        entry: "stand",
        states: [{ name: "stand", animation: "stand" }, { name: "launch", animation: "launch" }, { name: "fly", animation: "fly" }, { name: "land", animation: "land" }],
        transitions: [
          { from: "stand", to: "launch", duration: 0.05, conditions: [{ input: "launch" }] },
          { from: "launch", to: "fly", duration: 0.1, exitTime: 1 },
          { from: "fly", to: "land", duration: 0.1, conditions: [{ input: "land" }] },
          { from: "land", to: "stand", duration: 0.1, exitTime: 1 }
        ]
      },
      { name: "face", entry: "blink", states: [{ name: "blink", animation: "blink" }], transitions: [] }
    ]
  };
  return { model: b.build(), nodes: ids, stateMachine };
}
function mirrorD(d, axis) {
  return parseD(d).map((c) => {
    const m = (p) => `${2 * axis - p[0]},${p[1]}`;
    const vs = c;
    return `M${m([vs[0].x, vs[0].y])}` + vs.map((p, i) => {
      const q = vs[(i + 1) % vs.length];
      return `C${m(p.out)} ${m(q.in)} ${m([q.x, q.y])}`;
    }).join("") + "Z";
  }).join("");
}
var ROOT, read, argb, node, paths;
var init_mascot3 = __esm({
  "rig3/mascot3.ts"() {
    init_builder();
    ROOT = path.resolve(path.dirname(process.argv[1]), "..");
    read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
    argb = (hex) => (4278190080 | parseInt(hex.slice(1), 16)) >>> 0;
    node = (name, kids, pivot, extra = {}) => ({ kind: "node", name, pivot, kids, ...extra });
    paths = (els) => ({ kind: "paths", els });
  }
});

// rig3/.entry.ts
import fs2 from "node:fs";
var require_entry = __commonJS({
  "rig3/.entry.ts"() {
    init_mascot3();
    fs2.writeFileSync(process.argv[2], JSON.stringify(buildMascot3()));
  }
});
export default require_entry();
