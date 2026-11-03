var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/math.ts
var ident, mul, invert;
var init_math = __esm({
  "src/math.ts"() {
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

// src/ik.ts
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
  "src/ik.ts"() {
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

// src/core.ts
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
function resetPose(rig, pose) {
  "worklet";
  for (let i = 0; i < rig.base.length; i++) {
    const b = rig.base[i], p = pose.p[i];
    for (const k in p) if (!(k in b)) delete p[k];
    for (const k in b) p[k] = b[k];
  }
}
function cubicEase(x1, y1, x2, y2, x) {
  "worklet";
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bz = (t2, a1, a2) => (((1 - 3 * a2 + 3 * a1) * t2 + (3 * a2 - 6 * a1)) * t2 + 3 * a1) * t2;
  const sl = (t2, a1, a2) => 3 * (1 - 3 * a2 + 3 * a1) * t2 * t2 + 2 * (3 * a2 - 6 * a1) * t2 + 3 * a1;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const s = sl(t, x1, x2);
    if (Math.abs(s) < 1e-6) break;
    t -= (bz(t, x1, x2) - x) / s;
  }
  if (t < 0 || t > 1 || Math.abs(bz(t, x1, x2) - x) > 1e-5) {
    let a = 0, b = 1;
    for (let i = 0; i < 40; i++) {
      t = (a + b) / 2;
      if (bz(t, x1, x2) < x) a = t;
      else b = t;
    }
  }
  return bz(t, y1, y2);
}
function elasticEase(easing, amplitude, period, f) {
  "worklet";
  const s = amplitude < 1 ? period / 4 : period / (2 * Math.PI) * Math.asin(1 / amplitude);
  const amp = (time) => {
    if (amplitude < 1) {
      const t = Math.abs(s), a = Math.abs(time);
      if (a < t) {
        const l = a / t;
        return amplitude * l + (1 - l);
      }
    }
    return amplitude;
  };
  if (easing === 0) {
    const t = f - 1;
    return -(amp(t) * 2 ** (10 * t) * Math.sin((-t - s) * 2 * Math.PI / period));
  }
  if (easing === 2) {
    const t = f * 2 - 1, a = amp(t);
    return t < 0 ? -0.5 * a * 2 ** (10 * t) * Math.sin((-t - s) * 2 * Math.PI / period) : 0.5 * (a * 2 ** (-10 * t) * Math.sin((t - s) * 2 * Math.PI / period)) + 1;
  }
  return amp(f) * 2 ** (-10 * f) * Math.sin((f - s) * 2 * Math.PI / period) + 1;
}
function lerpColor(a, b, t) {
  "worklet";
  let r = 0;
  for (let sh = 0; sh < 32; sh += 8) {
    const ca = a >>> sh & 255, cb = b >>> sh & 255;
    r |= Math.round(ca + (cb - ca) * t) << sh;
  }
  return r >>> 0;
}
function applyAnimation(rig, pose, anim, seconds, mix = 1) {
  "worklet";
  const t = seconds * anim.fps;
  for (const ko of anim.keyed) {
    const p = pose.p[ko.objectId];
    if (!p) continue;
    for (const kp of ko.props) {
      const fr = kp.frames;
      if (!fr.length) continue;
      let value;
      if (t <= fr[0].frame) value = fr[0].value;
      else if (t >= fr[fr.length - 1].frame) value = fr[fr.length - 1].value;
      else {
        let i = 0;
        while (fr[i + 1].frame <= t) i++;
        const a = fr[i], b = fr[i + 1];
        let f = (t - a.frame) / (b.frame - a.frame);
        if (a.interpolationType === 0) value = a.value;
        else {
          if (a.interpolationType === 2 && a.interpolatorId != null) {
            const it = rig.interpolators[a.interpolatorId];
            if (it) f = it.type === "ElasticInterpolator" ? elasticEase(num2(it.p.easingValue, 1), num2(it.p.amplitude, 1), num2(it.p.period, 1), f) : cubicEase(num2(it.p.x1, 0.42), num2(it.p.y1, 0), num2(it.p.x2, 0.58), num2(it.p.y2, 1), f);
          }
          value = kp.color ? lerpColor(a.value, b.value, f) : a.value + (b.value - a.value) * f;
        }
      }
      let discrete = true;
      for (const k of fr) if (k.interpolationType !== 0) {
        discrete = false;
        break;
      }
      if (mix >= 1 || discrete && mix >= 0.5) p[kp.name] = value;
      else if (discrete) continue;
      else {
        const d = kp.name === "scaleX" || kp.name === "scaleY" || kp.name === "opacity" ? 1 : 0, cur = num2(p[kp.name], d);
        p[kp.name] = kp.color ? lerpColor(num2(p[kp.name], 0), value, mix) : cur + (value - cur) * mix;
      }
    }
  }
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
function isHidden(rig, pose, i) {
  "worklet";
  for (let p = i; p != null; p = rig.components[p].parent) {
    if (pose.hidden[p]) return true;
    if (p === 0) break;
  }
  return false;
}
function vertex(rig, pose, v, path) {
  "worklet";
  const o = pose.p[v], T2 = rig.components[v].type, x = num2(o.x, 0), y = num2(o.y, 0);
  let ix = x, iy = y, ox = x, oy = y;
  if (T2 === "CubicDetachedVertex") {
    ix = x + Math.cos(num2(o.inRotation, 0)) * num2(o.inDistance, 0);
    iy = y + Math.sin(num2(o.inRotation, 0)) * num2(o.inDistance, 0);
    ox = x + Math.cos(num2(o.outRotation, 0)) * num2(o.outDistance, 0);
    oy = y + Math.sin(num2(o.outRotation, 0)) * num2(o.outDistance, 0);
  } else if (T2 === "CubicMirroredVertex") {
    const dx = Math.cos(num2(o.rotation, 0)) * num2(o.distance, 0), dy = Math.sin(num2(o.rotation, 0)) * num2(o.distance, 0);
    ix = x - dx;
    iy = y - dy;
    ox = x + dx;
    oy = y + dy;
  } else if (T2 === "CubicAsymmetricVertex") {
    const co = Math.cos(num2(o.rotation, 0)), si = Math.sin(num2(o.rotation, 0));
    ix = x - co * num2(o.inDistance, 0);
    iy = y - si * num2(o.inDistance, 0);
    ox = x + co * num2(o.outDistance, 0);
    oy = y + si * num2(o.outDistance, 0);
  }
  const cubic = T2 === "StraightVertex" ? 0 : 1, radius = num2(o.radius, 0);
  const skin = rig.skinOf[path], w = rig.weightOf[v];
  if (skin != null && w != null) {
    const sp = pose.p[skin], bind = [num2(sp.xx, 1), num2(sp.xy, 0), num2(sp.yx, 0), num2(sp.yy, 1), num2(sp.tx, 0), num2(sp.ty, 0)];
    const mats = pose.boneMats[skin], wp = pose.p[w];
    const def = (px, py, indices, values) => {
      const m = [0, 0, 0, 0, 0, 0];
      for (let k = 0; k < 4; k++) {
        const wt = values >>> k * 8 & 255;
        if (!wt) continue;
        const M2 = mats[indices >>> k * 8 & 255] || [1, 0, 0, 1, 0, 0];
        for (let j = 0; j < 6; j++) m[j] += M2[j] * wt / 255;
      }
      const bx = ax(bind, px, py), by = ay(bind, px, py);
      return [m[0] * bx + m[2] * by + m[4], m[1] * bx + m[3] * by + m[5]];
    };
    const P0 = def(x, y, num2(wp.indices, 1), num2(wp.values, 255));
    const PI = def(ix, iy, num2(wp.inIndices, 1), num2(wp.inValues, 255));
    const PO = def(ox, oy, num2(wp.outIndices, 1), num2(wp.outValues, 255));
    return [P0[0], P0[1], PI[0], PI[1], PO[0], PO[1], cubic, radius];
  }
  const M = pose.world[path];
  return [ax(M, x, y), ay(M, x, y), ax(M, ix, iy), ay(M, ix, iy), ax(M, ox, oy), ay(M, ox, oy), cubic, radius];
}
function buildPath(rig, pose, path, view, out) {
  "worklet";
  const vids = rig.verts[path] || [], n = vids.length;
  if (n < 2) return;
  const vs = vids.map((v) => vertex(rig, pose, v, path));
  const V = (x, y) => [ax(view, x, y), ay(view, x, y)];
  const ideal = (tpx, tpy, tnx, tny, r) => {
    const ang = Math.abs(Math.atan2(tpx * tny - tpy * tnx, tpx * tnx + tpy * tny));
    return Math.min(r, 4 / 3 * Math.tan(Math.PI / (2 * (2 * Math.PI / ang))) * r * (ang < Math.PI / 2 ? 1 + Math.cos(ang) : 2 - Math.sin(ang)));
  };
  const corner = (i) => {
    const v = vs[i], pr = vs[(i - 1 + n) % n], nx = vs[(i + 1) % n];
    let tpx = (pr[6] ? pr[4] : pr[0]) - v[0], tpy = (pr[6] ? pr[5] : pr[1]) - v[1];
    const lp = Math.hypot(tpx, tpy) || 1;
    tpx /= lp;
    tpy /= lp;
    let tnx = (nx[6] ? nx[2] : nx[0]) - v[0], tny = (nx[6] ? nx[3] : nx[1]) - v[1];
    const ln = Math.hypot(tnx, tny) || 1;
    tnx /= ln;
    tny /= ln;
    const r = Math.min(lp / 2, ln / 2, Math.abs(v[7])), d = ideal(tpx, tpy, tnx, tny, r);
    return [v[0] + tpx * r, v[1] + tpy * r, v[0] + tpx * (r - d), v[1] + tpy * (r - d), v[0] + tnx * (r - d), v[1] + tny * (r - d), v[0] + tnx * r, v[1] + tny * r];
  };
  const M = (x, y) => {
    const a = V(x, y);
    out.push([0, a[0], a[1]]);
  };
  const L = (x, y) => {
    const a = V(x, y);
    out.push([1, a[0], a[1]]);
  };
  const C = (a, b, c2, d, e, f2) => {
    const p1 = V(a, b), p2 = V(c2, d), p3 = V(e, f2);
    out.push([2, p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]]);
  };
  let ox, oy, prevCubic, sx, sy, six, siy, startCubic;
  const f = vs[0];
  if (f[6]) {
    startCubic = prevCubic = true;
    six = f[2];
    siy = f[3];
    ox = f[4];
    oy = f[5];
    sx = f[0];
    sy = f[1];
    M(sx, sy);
  } else if (f[7]) {
    const k = corner(0);
    startCubic = prevCubic = false;
    sx = six = k[0];
    sy = siy = k[1];
    M(sx, sy);
    C(k[2], k[3], k[4], k[5], k[6], k[7]);
    ox = k[6];
    oy = k[7];
  } else {
    startCubic = prevCubic = false;
    sx = six = ox = f[0];
    sy = siy = oy = f[1];
    M(sx, sy);
  }
  for (let i = 1; i < n; i++) {
    const v = vs[i];
    if (v[6]) {
      C(ox, oy, v[2], v[3], v[0], v[1]);
      prevCubic = true;
      ox = v[4];
      oy = v[5];
    } else if (v[7]) {
      const k = corner(i);
      if (prevCubic) C(ox, oy, k[0], k[1], k[0], k[1]);
      else L(k[0], k[1]);
      C(k[2], k[3], k[4], k[5], k[6], k[7]);
      ox = k[6];
      oy = k[7];
      prevCubic = false;
    } else {
      if (prevCubic) C(ox, oy, v[0], v[1], v[0], v[1]);
      else L(v[0], v[1]);
      ox = v[0];
      oy = v[1];
      prevCubic = false;
    }
  }
  if (pose.p[path].isClosed) {
    if (prevCubic || startCubic) C(ox, oy, six, siy, sx, sy);
    out.push([3]);
  }
}
function shapePath(rig, pose, s, view) {
  "worklet";
  const out = [];
  for (const pi of rig.paths[s] || []) if (!pose.hidden[pi]) buildPath(rig, pose, pi, view, out);
  return out;
}
function displayList(rig, pose, view = [1, 0, 0, 1, 0, 0]) {
  "worklet";
  const c = rig.components, list = [];
  const viewScale = Math.sqrt(Math.abs(view[0] * view[3] - view[1] * view[2]));
  for (const s of rig.drawables) {
    if (isHidden(rig, pose, s) || num2(pose.p[s].drawableFlags, 0) & 1) continue;
    const alpha = pose.opacity[s];
    if (alpha <= 0) continue;
    const op = { path: shapePath(rig, pose, s, view), clips: [], paints: [] };
    for (let p = s; p != null; p = c[p].parent) {
      for (const cl of rig.clips[p] || []) {
        const cp = pose.p[cl];
        if (cp.isVisible === false) continue;
        const cpath = [];
        for (const sh of rig.clipShapes[num2(cp.sourceId, -1)] || []) for (const pi of rig.paths[sh] || []) buildPath(rig, pose, pi, view, cpath);
        op.clips.push({ path: cpath, evenOdd: num2(cp.fillRule, 0) === 1 });
      }
      if (p === 0) break;
    }
    const W = pose.world[s], wScale = Math.sqrt(Math.abs(W[0] * W[3] - W[1] * W[2]));
    for (const pi of rig.paints[s]) {
      const paint = pose.p[pi];
      if (paint.isVisible === false) continue;
      const mi = rig.mutator[pi];
      let shader = { kind: "solid", color: withAlpha(4285822068, alpha) };
      if (mi != null) {
        const m = pose.p[mi], T2 = c[mi].type;
        if (T2 === "SolidColor") shader = { kind: "solid", color: withAlpha(num2(m.colorValue, 4285822068), (num2(m.colorValue, 4285822068) >>> 24 & 255) / 255 * alpha) };
        else {
          const gx0 = ax(W, num2(m.startX, 0), num2(m.startY, 0)), gy0 = ay(W, num2(m.startX, 0), num2(m.startY, 0)), gx1 = ax(W, num2(m.endX, 0), num2(m.endY, 0)), gy1 = ay(W, num2(m.endX, 0), num2(m.endY, 0));
          const x0 = ax(view, gx0, gy0), y0 = ay(view, gx0, gy0), x1 = ax(view, gx1, gy1), y1 = ay(view, gx1, gy1);
          const stops = (rig.stops[mi] || []).map((k) => ({ pos: Math.min(1, Math.max(0, num2(pose.p[k].position, 0))), col: num2(pose.p[k].colorValue, 4294967295) })).sort((a, b) => a.pos - b.pos);
          const ga = alpha * num2(m.opacity, 1);
          const colors = stops.map((st) => withAlpha(st.col, (st.col >>> 24 & 255) / 255 * ga)), positions = stops.map((st) => st.pos);
          shader = T2 === "RadialGradient" ? { kind: "radial", cx: x0, cy: y0, r: Math.hypot(x1 - x0, y1 - y0), colors, positions } : { kind: "linear", x0, y0, x1, y1, colors, positions };
        }
      }
      if (c[pi].type === "Fill") op.paints.push({ style: "fill", shader, evenOdd: num2(paint.fillRule, 0) === 1 });
      else op.paints.push({ style: "stroke", shader, width: num2(paint.thickness, 1) * (paint.transformAffectsStroke === false ? 1 : wScale) * viewScale, cap: num2(paint.cap, 0), join: num2(paint.join, 0) });
    }
    list.push(op);
  }
  return list;
}
var ax, ay, num2, withAlpha;
var init_core = __esm({
  "src/core.ts"() {
    "use strict";
    init_math();
    init_ik();
    ax = (m, x, y) => {
      "worklet";
      return m[0] * x + m[2] * y + m[4];
    };
    ay = (m, x, y) => {
      "worklet";
      return m[1] * x + m[3] * y + m[5];
    };
    num2 = (v, d) => {
      "worklet";
      return typeof v === "number" ? v : d;
    };
    withAlpha = (argb, a) => {
      "worklet";
      return (Math.round((argb >>> 24 & 255) * Math.max(0, Math.min(1, a))) << 24 | argb & 16777215) >>> 0;
    };
  }
});

// src/builder.ts
var T, N, RigBuilder;
var init_builder = __esm({
  "src/builder.ts"() {
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

// src/state-machine.ts
function createSM(sm) {
  "worklet";
  const values = {};
  for (const i of sm.inputs) values[i.name] = i.value ?? (i.type === "number" ? 0 : false);
  return { values, fired: {}, events: [], layers: sm.layers.map((l) => ({ state: Math.max(0, l.states.findIndex((s) => s.name === l.entry)), time: 0, from: -1, fromTime: 0, mix: 1, mixDur: 0 })) };
}
function setInput(inst, name, value) {
  "worklet";
  if (value === void 0) inst.fired[name] = true;
  else inst.values[name] = value;
}
function animOf(rig, name) {
  "worklet";
  if (name == null) return null;
  for (const a of rig.animations) if (a.name === name) return a;
  return null;
}
function localTime(rig, st, t) {
  "worklet";
  const a = animOf(rig, st.animation);
  if (!a) return t;
  const D = a.duration / a.fps, loop = st.loop ?? a.loop === 1;
  if (a.loop === 2 && st.loop === void 0) {
    const k = Math.floor(t / D);
    const r = t - k * D;
    return k % 2 ? D - r : r;
  }
  return loop ? t % D : Math.min(t, D);
}
function holds(inst, c) {
  "worklet";
  if (inst.fired[c.input]) return true;
  const v = inst.values[c.input];
  if (c.value === void 0) return v === true;
  const a = typeof v === "boolean" ? v ? 1 : 0 : v ?? 0, b = typeof c.value === "boolean" ? c.value ? 1 : 0 : c.value;
  switch (c.op ?? "==") {
    case "!=":
      return a !== b;
    case ">":
      return a > b;
    case "<":
      return a < b;
    case ">=":
      return a >= b;
    case "<=":
      return a <= b;
    default:
      return a === b;
  }
}
function advanceSM(rig, pose, sm, inst, dt) {
  "worklet";
  sm.layers.forEach((layer, li) => {
    const run = inst.layers[li];
    const cur = layer.states[run.state];
    run.time += dt * (cur.speed ?? 1);
    if (run.from >= 0) {
      run.fromTime += dt * (layer.states[run.from].speed ?? 1);
      run.mix = run.mixDur > 0 ? Math.min(1, run.mix + dt / run.mixDur) : 1;
      if (run.mix >= 1) run.from = -1;
    }
    for (const tr of layer.transitions) {
      if (tr.from !== "*" && tr.from !== cur.name) continue;
      if (tr.from === "*" && tr.to === cur.name) continue;
      if (tr.exitTime != null) {
        const a2 = animOf(rig, cur.animation);
        if (a2 && run.time < tr.exitTime * a2.duration / a2.fps) continue;
      }
      if (!(tr.conditions || []).every((c) => holds(inst, c))) continue;
      const to = layer.states.findIndex((s2) => s2.name === tr.to);
      if (to < 0) continue;
      for (const c of tr.conditions || []) if (inst.fired[c.input]) inst.fired[c.input] = false;
      run.from = run.state;
      run.fromTime = run.time;
      run.state = to;
      run.time = 0;
      run.mixDur = tr.duration ?? 0;
      run.mix = run.mixDur > 0 ? 0 : 1;
      if (run.mix >= 1) run.from = -1;
      inst.events.push(`${layer.name}:${tr.to}`);
      break;
    }
    if (run.from >= 0) {
      const f = layer.states[run.from], fa = animOf(rig, f.animation);
      if (fa) applyAnimation(rig, pose, fa, localTime(rig, f, run.fromTime), 1);
    }
    const s = layer.states[run.state], a = animOf(rig, s.animation);
    if (a) applyAnimation(rig, pose, a, localTime(rig, s, run.time), run.from >= 0 ? run.mix : 1);
  });
  for (const k in inst.fired) inst.fired[k] = false;
}
var init_state_machine = __esm({
  "src/state-machine.ts"() {
    "use strict";
    init_core();
  }
});

// test/unit.test.ts
var require_unit_test = __commonJS({
  "test/unit.test.ts"() {
    init_builder();
    init_core();
    init_state_machine();
    var failed = 0;
    var ok = (cond, msg) => {
      console.log(`${cond ? "ok  " : "FAIL"} ${msg}`);
      if (!cond) failed++;
    };
    var near = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;
    for (const invertDirection of [false, true]) {
      const b = new RigBuilder(400, 400);
      const root = b.node(0, { x: 100, y: 100 });
      const upper = b.rootBone(root, { length: 50 });
      const lower = b.bone(upper, { length: 50 });
      const target = b.node(0, { x: 150, y: 150 });
      b.ik(lower, target, { invertDirection });
      const rig = compileRig(b.build()), pose = createPose(rig);
      solve(rig, pose);
      const w = pose.world[lower], tipX = w[0] * 50 + w[4], tipY = w[1] * 50 + w[5];
      ok(near(tipX, 150) && near(tipY, 150), `IK (invert=${invertDirection}) tip reaches target: (${tipX.toFixed(2)}, ${tipY.toFixed(2)})`);
      const elbowY = pose.world[lower][5];
      ok(invertDirection ? elbowY > 100 + 50 * 0.2 || elbowY < 150 : true, `IK (invert=${invertDirection}) elbow at (${pose.world[lower][4].toFixed(1)}, ${elbowY.toFixed(1)})`);
    }
    {
      const b = new RigBuilder(400, 400);
      const root = b.node(0, { x: 0, y: 0 });
      const upper = b.rootBone(root, { length: 100 });
      const lower = b.bone(upper, { length: 100 });
      const shape = b.shape(0);
      const path = b.path(shape, [[0, -10], [200, -10], [200, 10], [0, 10]]);
      b.fill(shape, 4278190080);
      b.skin(path, [upper, lower]);
      const rig = compileRig(b.build()), pose = createPose(rig);
      resetPose(rig, pose);
      pose.p[lower].rotation = Math.PI / 2;
      solve(rig, pose);
      const list = displayList(rig, pose);
      const pts = list[0].path.filter((c) => c[0] === 0 || c[0] === 1).map((c) => [c[1], c[2]]);
      ok(near(pts[1][0], 110, 1) && near(pts[1][1], 100, 1), `skin: hand-end vertex \u2192 (${pts[1][0].toFixed(1)}, ${pts[1][1].toFixed(1)}) expected (110, 100)`);
      ok(near(pts[0][0], 0, 1) && near(pts[0][1], -10, 1), `skin: shoulder vertex stays \u2192 (${pts[0][0].toFixed(1)}, ${pts[0][1].toFixed(1)})`);
    }
    {
      const b = new RigBuilder(100, 100);
      const n = b.node(0, { x: 0 });
      b.animation("idle", 60, 60, { [n]: { x: [[0, 0], [60, 10]] } }, 1);
      b.animation("jump", 60, 60, { [n]: { x: [[0, 100], [60, 100]] } });
      const rig = compileRig(b.build()), pose = createPose(rig);
      const sm = { name: "main", inputs: [{ name: "go", type: "trigger" }, { name: "speed", type: "number" }], layers: [{
        name: "body",
        entry: "idle",
        states: [{ name: "idle", animation: "idle" }, { name: "jump", animation: "jump" }, { name: "fast", animation: "idle", speed: 2 }],
        transitions: [{ from: "idle", to: "jump", duration: 0.5, conditions: [{ input: "go" }] }, { from: "*", to: "fast", conditions: [{ input: "speed", op: ">", value: 5 }] }]
      }] };
      const inst = createSM(sm);
      const step = (dt) => {
        resetPose(rig, pose);
        advanceSM(rig, pose, sm, inst, dt);
        solve(rig, pose);
        return pose.p[n].x;
      };
      const x0 = step(0.5);
      ok(near(x0, 5, 0.01), `SM idle at 0.5 s \u2192 x = ${x0.toFixed(3)} (expected 5)`);
      setInput(inst, "go");
      const x1 = step(0.25);
      const x2 = step(0.25);
      ok(near(x1, 7.5, 0.01), `SM transition starts with idle still showing \u2192 x = ${x1.toFixed(3)} (expected 7.5)`);
      ok(near(x2, 50, 0.5), `SM halfway through 0.5 s blend \u2192 x = ${x2.toFixed(3)} (expected \u2248 50)`);
      const x3 = step(0.3);
      ok(near(x3, 100, 0.01), `SM blend finished \u2192 x = ${x3.toFixed(3)} (expected 100)`);
      ok(inst.fired.go === false, "SM trigger consumed");
      setInput(inst, "speed", 9);
      step(0.01);
      ok(sm.layers[0].states[inst.layers[0].state].name === "fast", `SM any-state transition on number input \u2192 ${sm.layers[0].states[inst.layers[0].state].name}`);
    }
    {
      const b = new RigBuilder(10, 10);
      const n = b.node(0, { x: 0 });
      b.animation("a", 60, 60, { [n]: { x: [[0, 40]] } });
      const rig = compileRig(b.build()), pose = createPose(rig);
      resetPose(rig, pose);
      applyAnimation(rig, pose, rig.animations[0], 0, 0.25);
      ok(near(pose.p[n].x, 10, 1e-6), `applyAnimation mix 0.25 \u2192 ${pose.p[n].x}`);
    }
    {
      const b = new RigBuilder(10, 10);
      const n = b.node(0, {});
      b.animation("s", 60, 60, { [n]: { scaleX: [[0, 1.2]] } });
      const rig = compileRig(b.build()), pose = createPose(rig);
      resetPose(rig, pose);
      applyAnimation(rig, pose, rig.animations[0], 0, 0.5);
      ok(near(pose.p[n].scaleX, 1.1, 1e-6), `blend unkeyed scaleX from default 1 \u2192 ${pose.p[n].scaleX}`);
    }
    {
      const b = new RigBuilder(10, 10);
      const n = b.node(0, { activeComponentId: 3 });
      b.animation("h", 60, 60, { [n]: { activeComponentId: [[0, 7, "hold"]] } });
      const rig = compileRig(b.build()), pose = createPose(rig);
      resetPose(rig, pose);
      applyAnimation(rig, pose, rig.animations[0], 0, 0.3);
      const a = pose.p[n].activeComponentId;
      resetPose(rig, pose);
      applyAnimation(rig, pose, rig.animations[0], 0, 0.7);
      ok(a === 3 && pose.p[n].activeComponentId === 7, `discrete snap: mix 0.3 \u2192 ${a}, mix 0.7 \u2192 ${pose.p[n].activeComponentId}`);
    }
    console.log(failed ? `
${failed} FAILED` : "\nall passed");
    if (failed) process.exit(1);
  }
});
export default require_unit_test();
