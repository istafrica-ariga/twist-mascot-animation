"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // twist-rig/src/types.ts
  var init_types = __esm({
    "twist-rig/src/types.ts"() {
      "use strict";
    }
  });

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
    const o = pose.p[v], T = rig.components[v].type, x = num2(o.x, 0), y = num2(o.y, 0);
    let ix = x, iy = y, ox = x, oy = y;
    if (T === "CubicDetachedVertex") {
      ix = x + Math.cos(num2(o.inRotation, 0)) * num2(o.inDistance, 0);
      iy = y + Math.sin(num2(o.inRotation, 0)) * num2(o.inDistance, 0);
      ox = x + Math.cos(num2(o.outRotation, 0)) * num2(o.outDistance, 0);
      oy = y + Math.sin(num2(o.outRotation, 0)) * num2(o.outDistance, 0);
    } else if (T === "CubicMirroredVertex") {
      const dx = Math.cos(num2(o.rotation, 0)) * num2(o.distance, 0), dy = Math.sin(num2(o.rotation, 0)) * num2(o.distance, 0);
      ix = x - dx;
      iy = y - dy;
      ox = x + dx;
      oy = y + dy;
    } else if (T === "CubicAsymmetricVertex") {
      const co = Math.cos(num2(o.rotation, 0)), si = Math.sin(num2(o.rotation, 0));
      ix = x - co * num2(o.inDistance, 0);
      iy = y - si * num2(o.inDistance, 0);
      ox = x + co * num2(o.outDistance, 0);
      oy = y + si * num2(o.outDistance, 0);
    }
    const cubic = T === "StraightVertex" ? 0 : 1, radius = num2(o.radius, 0);
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
          const m = pose.p[mi], T = c[mi].type;
          if (T === "SolidColor") shader = { kind: "solid", color: withAlpha(num2(m.colorValue, 4285822068), (num2(m.colorValue, 4285822068) >>> 24 & 255) / 255 * alpha) };
          else {
            const gx0 = ax(W, num2(m.startX, 0), num2(m.startY, 0)), gy0 = ay(W, num2(m.startX, 0), num2(m.startY, 0)), gx1 = ax(W, num2(m.endX, 0), num2(m.endY, 0)), gy1 = ay(W, num2(m.endX, 0), num2(m.endY, 0));
            const x0 = ax(view, gx0, gy0), y0 = ay(view, gx0, gy0), x1 = ax(view, gx1, gy1), y1 = ay(view, gx1, gy1);
            const stops = (rig.stops[mi] || []).map((k) => ({ pos: Math.min(1, Math.max(0, num2(pose.p[k].position, 0))), col: num2(pose.p[k].colorValue, 4294967295) })).sort((a, b) => a.pos - b.pos);
            const ga = alpha * num2(m.opacity, 1);
            const colors = stops.map((st) => withAlpha(st.col, (st.col >>> 24 & 255) / 255 * ga)), positions = stops.map((st) => st.pos);
            shader = T === "RadialGradient" ? { kind: "radial", cx: x0, cy: y0, r: Math.hypot(x1 - x0, y1 - y0), colors, positions } : { kind: "linear", x0, y0, x1, y1, colors, positions };
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
    "twist-rig/src/core.ts"() {
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

  // twist-rig/src/render/canvas2d.ts
  function toPath2D(cmds) {
    const p = new Path2D();
    for (const k of cmds) {
      if (k[0] === 0) p.moveTo(k[1], k[2]);
      else if (k[0] === 1) p.lineTo(k[1], k[2]);
      else if (k[0] === 2) p.bezierCurveTo(k[1], k[2], k[3], k[4], k[5], k[6]);
      else p.closePath();
    }
    return p;
  }
  function style(ctx, s) {
    if (s.kind === "solid") return css(s.color);
    const g = s.kind === "linear" ? ctx.createLinearGradient(s.x0, s.y0, s.x1, s.y1) : ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, s.r);
    s.colors.forEach((c, i) => g.addColorStop(s.positions[i], css(c)));
    return g;
  }
  function drawCanvas2D(ctx, list) {
    for (const op of list) {
      ctx.save();
      for (const cl of op.clips) ctx.clip(toPath2D(cl.path), cl.evenOdd ? "evenodd" : "nonzero");
      const path = toPath2D(op.path);
      for (const p of op.paints) {
        if (p.style === "fill") {
          ctx.fillStyle = style(ctx, p.shader);
          ctx.fill(path, p.evenOdd ? "evenodd" : "nonzero");
        } else {
          ctx.strokeStyle = style(ctx, p.shader);
          ctx.lineWidth = p.width ?? 1;
          ctx.lineCap = ["butt", "round", "square"][p.cap ?? 0];
          ctx.lineJoin = ["miter", "round", "bevel"][p.join ?? 0];
          ctx.stroke(path);
        }
      }
      ctx.restore();
    }
  }
  var css;
  var init_canvas2d = __esm({
    "twist-rig/src/render/canvas2d.ts"() {
      "use strict";
      css = (argb) => `rgba(${argb >>> 16 & 255},${argb >>> 8 & 255},${argb & 255},${(argb >>> 24 & 255) / 255})`;
    }
  });

  // twist-rig/src/render/skia.ts
  function toSkPath(Skia, cmds, evenOdd) {
    "worklet";
    const p = Skia.Path.Make();
    for (const k of cmds) {
      if (k[0] === 0) p.moveTo(k[1], k[2]);
      else if (k[0] === 1) p.lineTo(k[1], k[2]);
      else if (k[0] === 2) p.cubicTo(k[1], k[2], k[3], k[4], k[5], k[6]);
      else p.close();
    }
    p.setFillType(evenOdd ? 1 : 0);
    return p;
  }
  function shaderPaint(Skia, paint, s) {
    "worklet";
    if (s.kind === "solid") {
      paint.setColor(Skia.Color(s.color));
      return;
    }
    paint.setColor(Skia.Color(4278190080));
    const colors = s.colors.map((c) => Skia.Color(c));
    paint.setShader(s.kind === "linear" ? Skia.Shader.MakeLinearGradient({ x: s.x0, y: s.y0 }, { x: s.x1, y: s.y1 }, colors, s.positions, 0) : Skia.Shader.MakeRadialGradient({ x: s.cx, y: s.cy }, s.r, colors, s.positions, 0));
  }
  function drawSkia(Skia, canvas, list) {
    "worklet";
    for (const op of list) {
      canvas.save();
      for (const cl of op.clips) canvas.clipPath(toSkPath(Skia, cl.path, cl.evenOdd), 1, true);
      for (const p of op.paints) {
        const paint = Skia.Paint();
        paint.setAntiAlias(true);
        shaderPaint(Skia, paint, p.shader);
        if (p.style === "fill") {
          paint.setStyle(0);
          canvas.drawPath(toSkPath(Skia, op.path, !!p.evenOdd), paint);
        } else {
          paint.setStyle(1);
          paint.setStrokeWidth(p.width ?? 1);
          paint.setStrokeCap(p.cap ?? 0);
          paint.setStrokeJoin(p.join ?? 0);
          canvas.drawPath(toSkPath(Skia, op.path, false), paint);
        }
      }
      canvas.restore();
    }
  }
  var init_skia = __esm({
    "twist-rig/src/render/skia.ts"() {
      "use strict";
    }
  });

  // twist-rig/src/state-machine.ts
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
    "twist-rig/src/state-machine.ts"() {
      "use strict";
      init_core();
    }
  });

  // twist-rig/src/index.ts
  var src_exports = {};
  __export(src_exports, {
    advanceSM: () => advanceSM,
    applyAnimation: () => applyAnimation,
    compileRig: () => compileRig,
    createPose: () => createPose,
    createSM: () => createSM,
    displayList: () => displayList,
    drawCanvas2D: () => drawCanvas2D,
    drawSkia: () => drawSkia,
    ident: () => ident,
    invert: () => invert,
    mul: () => mul,
    recomputeFrom: () => recomputeFrom,
    resetPose: () => resetPose,
    setInput: () => setInput,
    solve: () => solve,
    solveIK: () => solveIK
  });
  var init_src = __esm({
    "twist-rig/src/index.ts"() {
      "use strict";
      init_types();
      init_core();
      init_canvas2d();
      init_skia();
      init_ik();
      init_state_machine();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/Host.js
  function _defineProperty(e, r, t) {
    return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: true, configurable: true, writable: true }) : e[r] = t, e;
  }
  function _toPropertyKey(t) {
    var i = _toPrimitive(t, "string");
    return "symbol" == typeof i ? i : i + "";
  }
  function _toPrimitive(t, r) {
    if ("object" != typeof t || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r || "default");
      if ("object" != typeof i) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  var throwNotImplementedOnRNWeb, Host, BaseHostObject, HostObject, getEnum, optEnum;
  var init_Host = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/Host.js"() {
      throwNotImplementedOnRNWeb = () => {
        if (typeof jest !== "undefined") {
          return jest.fn();
        }
        throw new Error("Not implemented on React Native Web");
      };
      Host = class {
        constructor(CanvasKit) {
          _defineProperty(this, "CanvasKit", void 0);
          this.CanvasKit = CanvasKit;
        }
      };
      BaseHostObject = class extends Host {
        constructor(CanvasKit, ref, typename) {
          super(CanvasKit);
          _defineProperty(this, "__typename__", void 0);
          _defineProperty(this, "ref", void 0);
          this.ref = ref;
          this.__typename__ = typename;
        }
        dispose() {
          this[Symbol.dispose]();
        }
        [Symbol.dispose]() {
          if (this.ref !== null && typeof this.ref === "object" && "delete" in this.ref && typeof this.ref.delete === "function") {
            this.ref.delete();
          }
        }
      };
      HostObject = class extends BaseHostObject {
        static fromValue(value) {
          return value.ref;
        }
      };
      getEnum = (CanvasKit, name, v) => {
        const e = CanvasKit[name];
        if (typeof e !== "function") {
          throw new Error(`${name} is not an number`);
        }
        const result = Object.values(e).find((entry) => entry !== null && typeof entry === "object" && "value" in entry && entry.value === v);
        if (!result) {
          throw new Error(`Enum ${name} does not have value ${v} on React Native Web`);
        }
        return result;
      };
      optEnum = (CanvasKit, name, v) => {
        return v === void 0 ? void 0 : getEnum(CanvasKit, name, v);
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPoint.js
  var JsiSkPoint;
  var init_JsiSkPoint = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPoint.js"() {
      init_Host();
      JsiSkPoint = class _JsiSkPoint extends BaseHostObject {
        static fromValue(point) {
          if (point instanceof _JsiSkPoint) {
            return point.ref;
          }
          return new Float32Array([point.x, point.y]);
        }
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "Point");
        }
        get x() {
          return this.ref[0];
        }
        get y() {
          return this.ref[1];
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkColorFilter.js
  var JsiSkColorFilter;
  var init_JsiSkColorFilter = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkColorFilter.js"() {
      init_Host();
      JsiSkColorFilter = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "ColorFilter");
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkImageFilter.js
  var JsiSkImageFilter;
  var init_JsiSkImageFilter = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkImageFilter.js"() {
      init_Host();
      JsiSkImageFilter = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "ImageFilter");
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkMaskFilter.js
  var JsiSkMaskFilter;
  var init_JsiSkMaskFilter = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkMaskFilter.js"() {
      init_Host();
      JsiSkMaskFilter = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "MaskFilter");
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPathEffect.js
  var JsiSkPathEffect;
  var init_JsiSkPathEffect = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPathEffect.js"() {
      init_Host();
      JsiSkPathEffect = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "PathEffect");
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkShader.js
  var JsiSkShader;
  var init_JsiSkShader = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkShader.js"() {
      init_Host();
      JsiSkShader = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "Shader");
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPaint.js
  var kBlendModePlusDarker, kBlendModePlusLighter, plusDarkerSkSL, plusLighterSkSL, blenderCache, getBlenderCache, JsiSkPaint;
  var init_JsiSkPaint = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPaint.js"() {
      init_Host();
      init_JsiSkColorFilter();
      init_JsiSkImageFilter();
      init_JsiSkMaskFilter();
      init_JsiSkPathEffect();
      init_JsiSkShader();
      kBlendModePlusDarker = 1001;
      kBlendModePlusLighter = 1002;
      plusDarkerSkSL = `
    vec4 main(vec4 src, vec4 dst) {
        float outAlpha = src.a + dst.a - src.a * dst.a;
        vec3 srcUnpremul = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
        vec3 dstUnpremul = dst.a > 0.0 ? dst.rgb / dst.a : vec3(0.0);
        vec3 blended = max(vec3(0.0), srcUnpremul + dstUnpremul - vec3(1.0));
        return vec4(blended * outAlpha, outAlpha);
    }
`;
      plusLighterSkSL = `
    vec4 main(vec4 src, vec4 dst) {
        float outAlpha = src.a + dst.a - src.a * dst.a;
        vec3 srcUnpremul = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
        vec3 dstUnpremul = dst.a > 0.0 ? dst.rgb / dst.a : vec3(0.0);
        vec3 blended = min(vec3(1.0), srcUnpremul + dstUnpremul);
        return vec4(blended * outAlpha, outAlpha);
    }
`;
      blenderCache = /* @__PURE__ */ new WeakMap();
      getBlenderCache = (ck) => {
        let cache = blenderCache.get(ck);
        if (!cache) {
          cache = {
            plusDarker: null,
            plusLighter: null
          };
          blenderCache.set(ck, cache);
        }
        return cache;
      };
      JsiSkPaint = class _JsiSkPaint extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "Paint");
        }
        copy() {
          return new _JsiSkPaint(this.CanvasKit, this.ref.copy());
        }
        assign(paint) {
          this.ref = paint.ref.copy();
        }
        reset() {
          this.ref = new this.CanvasKit.Paint();
        }
        getAlphaf() {
          return this.getColor()[3];
        }
        getColor() {
          return this.ref.getColor();
        }
        getStrokeCap() {
          return this.ref.getStrokeCap().value;
        }
        getStrokeJoin() {
          return this.ref.getStrokeJoin().value;
        }
        getStrokeMiter() {
          return this.ref.getStrokeMiter();
        }
        getStrokeWidth() {
          return this.ref.getStrokeWidth();
        }
        setAlphaf(alpha) {
          this.ref.setAlphaf(alpha);
        }
        setAntiAlias(aa) {
          this.ref.setAntiAlias(aa);
        }
        setDither(dither) {
          this.ref.setDither(dither);
        }
        setBlendMode(blendMode) {
          if (blendMode === kBlendModePlusDarker) {
            const cache = getBlenderCache(this.CanvasKit);
            if (!cache.plusDarker) {
              const effect = this.CanvasKit.RuntimeEffect.MakeForBlender(plusDarkerSkSL);
              if (effect) {
                cache.plusDarker = effect.makeBlender([]);
              }
            }
            if (cache.plusDarker) {
              this.ref.setBlender(cache.plusDarker);
            }
          } else if (blendMode === kBlendModePlusLighter) {
            const cache = getBlenderCache(this.CanvasKit);
            if (!cache.plusLighter) {
              const effect = this.CanvasKit.RuntimeEffect.MakeForBlender(plusLighterSkSL);
              if (effect) {
                cache.plusLighter = effect.makeBlender([]);
              }
            }
            if (cache.plusLighter) {
              this.ref.setBlender(cache.plusLighter);
            }
          } else {
            this.ref.setBlendMode(getEnum(this.CanvasKit, "BlendMode", blendMode));
          }
        }
        setColor(color) {
          this.ref.setColor(color);
        }
        setColorFilter(filter) {
          this.ref.setColorFilter(filter ? JsiSkColorFilter.fromValue(filter) : null);
        }
        setImageFilter(filter) {
          this.ref.setImageFilter(filter ? JsiSkImageFilter.fromValue(filter) : null);
        }
        setMaskFilter(filter) {
          this.ref.setMaskFilter(filter ? JsiSkMaskFilter.fromValue(filter) : null);
        }
        setPathEffect(effect) {
          this.ref.setPathEffect(effect ? JsiSkPathEffect.fromValue(effect) : null);
        }
        setShader(shader) {
          this.ref.setShader(shader ? JsiSkShader.fromValue(shader) : null);
        }
        setStrokeCap(cap) {
          this.ref.setStrokeCap(getEnum(this.CanvasKit, "StrokeCap", cap));
        }
        setStrokeJoin(join) {
          this.ref.setStrokeJoin(getEnum(this.CanvasKit, "StrokeJoin", join));
        }
        setStrokeMiter(limit) {
          this.ref.setStrokeMiter(limit);
        }
        setStrokeWidth(width) {
          this.ref.setStrokeWidth(width);
        }
        setStyle(style2) {
          this.ref.setStyle({
            value: style2
          });
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkRect.js
  var JsiSkRect;
  var init_JsiSkRect = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkRect.js"() {
      init_Host();
      JsiSkRect = class _JsiSkRect extends BaseHostObject {
        static fromValue(CanvasKit, rect) {
          if (rect instanceof _JsiSkRect) {
            return rect.ref;
          }
          return CanvasKit.XYWHRect(rect.x, rect.y, rect.width, rect.height);
        }
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "Rect");
        }
        setXYWH(x, y, width, height) {
          this.ref[0] = x;
          this.ref[1] = y;
          this.ref[2] = x + width;
          this.ref[3] = y + height;
        }
        get x() {
          return this.ref[0];
        }
        get y() {
          return this.ref[1];
        }
        get width() {
          return this.ref[2] - this.ref[0];
        }
        get height() {
          return this.ref[3] - this.ref[1];
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkColor.js
  var alphaf, red, green, blue, CSSColorTable, clampCSSByte, clampCSSFloat, parseCSSInt, parseCSSFloat, CSSHueToRGB, parseCSSColor, Color;
  var init_JsiSkColor = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkColor.js"() {
      alphaf = (c) => (c >> 24 & 255) / 255;
      red = (c) => c >> 16 & 255;
      green = (c) => c >> 8 & 255;
      blue = (c) => c & 255;
      CSSColorTable = {
        transparent: Float32Array.of(0, 0, 0, 0),
        aliceblue: Float32Array.of(240, 248, 255, 1),
        antiquewhite: Float32Array.of(250, 235, 215, 1),
        aqua: Float32Array.of(0, 255, 255, 1),
        aquamarine: Float32Array.of(127, 255, 212, 1),
        azure: Float32Array.of(240, 255, 255, 1),
        beige: Float32Array.of(245, 245, 220, 1),
        bisque: Float32Array.of(255, 228, 196, 1),
        black: Float32Array.of(0, 0, 0, 1),
        blanchedalmond: Float32Array.of(255, 235, 205, 1),
        blue: Float32Array.of(0, 0, 255, 1),
        blueviolet: Float32Array.of(138, 43, 226, 1),
        brown: Float32Array.of(165, 42, 42, 1),
        burlywood: Float32Array.of(222, 184, 135, 1),
        cadetblue: Float32Array.of(95, 158, 160, 1),
        chartreuse: Float32Array.of(127, 255, 0, 1),
        chocolate: Float32Array.of(210, 105, 30, 1),
        coral: Float32Array.of(255, 127, 80, 1),
        cornflowerblue: Float32Array.of(100, 149, 237, 1),
        cornsilk: Float32Array.of(255, 248, 220, 1),
        crimson: Float32Array.of(220, 20, 60, 1),
        cyan: Float32Array.of(0, 255, 255, 1),
        darkblue: Float32Array.of(0, 0, 139, 1),
        darkcyan: Float32Array.of(0, 139, 139, 1),
        darkgoldenrod: Float32Array.of(184, 134, 11, 1),
        darkgray: Float32Array.of(169, 169, 169, 1),
        darkgreen: Float32Array.of(0, 100, 0, 1),
        darkgrey: Float32Array.of(169, 169, 169, 1),
        darkkhaki: Float32Array.of(189, 183, 107, 1),
        darkmagenta: Float32Array.of(139, 0, 139, 1),
        darkolivegreen: Float32Array.of(85, 107, 47, 1),
        darkorange: Float32Array.of(255, 140, 0, 1),
        darkorchid: Float32Array.of(153, 50, 204, 1),
        darkred: Float32Array.of(139, 0, 0, 1),
        darksalmon: Float32Array.of(233, 150, 122, 1),
        darkseagreen: Float32Array.of(143, 188, 143, 1),
        darkslateblue: Float32Array.of(72, 61, 139, 1),
        darkslategray: Float32Array.of(47, 79, 79, 1),
        darkslategrey: Float32Array.of(47, 79, 79, 1),
        darkturquoise: Float32Array.of(0, 206, 209, 1),
        darkviolet: Float32Array.of(148, 0, 211, 1),
        deeppink: Float32Array.of(255, 20, 147, 1),
        deepskyblue: Float32Array.of(0, 191, 255, 1),
        dimgray: Float32Array.of(105, 105, 105, 1),
        dimgrey: Float32Array.of(105, 105, 105, 1),
        dodgerblue: Float32Array.of(30, 144, 255, 1),
        firebrick: Float32Array.of(178, 34, 34, 1),
        floralwhite: Float32Array.of(255, 250, 240, 1),
        forestgreen: Float32Array.of(34, 139, 34, 1),
        fuchsia: Float32Array.of(255, 0, 255, 1),
        gainsboro: Float32Array.of(220, 220, 220, 1),
        ghostwhite: Float32Array.of(248, 248, 255, 1),
        gold: Float32Array.of(255, 215, 0, 1),
        goldenrod: Float32Array.of(218, 165, 32, 1),
        gray: Float32Array.of(128, 128, 128, 1),
        green: Float32Array.of(0, 128, 0, 1),
        greenyellow: Float32Array.of(173, 255, 47, 1),
        grey: Float32Array.of(128, 128, 128, 1),
        honeydew: Float32Array.of(240, 255, 240, 1),
        hotpink: Float32Array.of(255, 105, 180, 1),
        indianred: Float32Array.of(205, 92, 92, 1),
        indigo: Float32Array.of(75, 0, 130, 1),
        ivory: Float32Array.of(255, 255, 240, 1),
        khaki: Float32Array.of(240, 230, 140, 1),
        lavender: Float32Array.of(230, 230, 250, 1),
        lavenderblush: Float32Array.of(255, 240, 245, 1),
        lawngreen: Float32Array.of(124, 252, 0, 1),
        lemonchiffon: Float32Array.of(255, 250, 205, 1),
        lightblue: Float32Array.of(173, 216, 230, 1),
        lightcoral: Float32Array.of(240, 128, 128, 1),
        lightcyan: Float32Array.of(224, 255, 255, 1),
        lightgoldenrodyellow: Float32Array.of(250, 250, 210, 1),
        lightgray: Float32Array.of(211, 211, 211, 1),
        lightgreen: Float32Array.of(144, 238, 144, 1),
        lightgrey: Float32Array.of(211, 211, 211, 1),
        lightpink: Float32Array.of(255, 182, 193, 1),
        lightsalmon: Float32Array.of(255, 160, 122, 1),
        lightseagreen: Float32Array.of(32, 178, 170, 1),
        lightskyblue: Float32Array.of(135, 206, 250, 1),
        lightslategray: Float32Array.of(119, 136, 153, 1),
        lightslategrey: Float32Array.of(119, 136, 153, 1),
        lightsteelblue: Float32Array.of(176, 196, 222, 1),
        lightyellow: Float32Array.of(255, 255, 224, 1),
        lime: Float32Array.of(0, 255, 0, 1),
        limegreen: Float32Array.of(50, 205, 50, 1),
        linen: Float32Array.of(250, 240, 230, 1),
        magenta: Float32Array.of(255, 0, 255, 1),
        maroon: Float32Array.of(128, 0, 0, 1),
        mediumaquamarine: Float32Array.of(102, 205, 170, 1),
        mediumblue: Float32Array.of(0, 0, 205, 1),
        mediumorchid: Float32Array.of(186, 85, 211, 1),
        mediumpurple: Float32Array.of(147, 112, 219, 1),
        mediumseagreen: Float32Array.of(60, 179, 113, 1),
        mediumslateblue: Float32Array.of(123, 104, 238, 1),
        mediumspringgreen: Float32Array.of(0, 250, 154, 1),
        mediumturquoise: Float32Array.of(72, 209, 204, 1),
        mediumvioletred: Float32Array.of(199, 21, 133, 1),
        midnightblue: Float32Array.of(25, 25, 112, 1),
        mintcream: Float32Array.of(245, 255, 250, 1),
        mistyrose: Float32Array.of(255, 228, 225, 1),
        moccasin: Float32Array.of(255, 228, 181, 1),
        navajowhite: Float32Array.of(255, 222, 173, 1),
        navy: Float32Array.of(0, 0, 128, 1),
        oldlace: Float32Array.of(253, 245, 230, 1),
        olive: Float32Array.of(128, 128, 0, 1),
        olivedrab: Float32Array.of(107, 142, 35, 1),
        orange: Float32Array.of(255, 165, 0, 1),
        orangered: Float32Array.of(255, 69, 0, 1),
        orchid: Float32Array.of(218, 112, 214, 1),
        palegoldenrod: Float32Array.of(238, 232, 170, 1),
        palegreen: Float32Array.of(152, 251, 152, 1),
        paleturquoise: Float32Array.of(175, 238, 238, 1),
        palevioletred: Float32Array.of(219, 112, 147, 1),
        papayawhip: Float32Array.of(255, 239, 213, 1),
        peachpuff: Float32Array.of(255, 218, 185, 1),
        peru: Float32Array.of(205, 133, 63, 1),
        pink: Float32Array.of(255, 192, 203, 1),
        plum: Float32Array.of(221, 160, 221, 1),
        powderblue: Float32Array.of(176, 224, 230, 1),
        purple: Float32Array.of(128, 0, 128, 1),
        rebeccapurple: Float32Array.of(102, 51, 153, 1),
        red: Float32Array.of(255, 0, 0, 1),
        rosybrown: Float32Array.of(188, 143, 143, 1),
        royalblue: Float32Array.of(65, 105, 225, 1),
        saddlebrown: Float32Array.of(139, 69, 19, 1),
        salmon: Float32Array.of(250, 128, 114, 1),
        sandybrown: Float32Array.of(244, 164, 96, 1),
        seagreen: Float32Array.of(46, 139, 87, 1),
        seashell: Float32Array.of(255, 245, 238, 1),
        sienna: Float32Array.of(160, 82, 45, 1),
        silver: Float32Array.of(192, 192, 192, 1),
        skyblue: Float32Array.of(135, 206, 235, 1),
        slateblue: Float32Array.of(106, 90, 205, 1),
        slategray: Float32Array.of(112, 128, 144, 1),
        slategrey: Float32Array.of(112, 128, 144, 1),
        snow: Float32Array.of(255, 250, 250, 1),
        springgreen: Float32Array.of(0, 255, 127, 1),
        steelblue: Float32Array.of(70, 130, 180, 1),
        tan: Float32Array.of(210, 180, 140, 1),
        teal: Float32Array.of(0, 128, 128, 1),
        thistle: Float32Array.of(216, 191, 216, 1),
        tomato: Float32Array.of(255, 99, 71, 1),
        turquoise: Float32Array.of(64, 224, 208, 1),
        violet: Float32Array.of(238, 130, 238, 1),
        wheat: Float32Array.of(245, 222, 179, 1),
        white: Float32Array.of(255, 255, 255, 1),
        whitesmoke: Float32Array.of(245, 245, 245, 1),
        yellow: Float32Array.of(255, 255, 0, 1),
        yellowgreen: Float32Array.of(154, 205, 50, 1)
      };
      clampCSSByte = (j) => {
        const i = Math.round(j);
        return i < 0 ? 0 : i > 255 ? 255 : i;
      };
      clampCSSFloat = (f) => {
        return f < 0 ? 0 : f > 1 ? 1 : f;
      };
      parseCSSInt = (str) => {
        if (str[str.length - 1] === "%") {
          return clampCSSByte(parseFloat(str) / 100 * 255);
        }
        return clampCSSByte(parseInt(str));
      };
      parseCSSFloat = (str) => {
        if (str === void 0) {
          return 1;
        }
        if (str[str.length - 1] === "%") {
          return clampCSSFloat(parseFloat(str) / 100);
        }
        return clampCSSFloat(parseFloat(str));
      };
      CSSHueToRGB = (m1, m2, h) => {
        if (h < 0) {
          h += 1;
        } else if (h > 1) {
          h -= 1;
        }
        if (h * 6 < 1) {
          return m1 + (m2 - m1) * h * 6;
        }
        if (h * 2 < 1) {
          return m2;
        }
        if (h * 3 < 2) {
          return m1 + (m2 - m1) * (2 / 3 - h) * 6;
        }
        return m1;
      };
      parseCSSColor = (cssStr) => {
        var str = cssStr.replace(/ /g, "").toLowerCase();
        if (str in CSSColorTable) {
          const cl = CSSColorTable[str];
          if (cl) {
            return Float32Array.of(...cl);
          }
          return null;
        }
        if (str[0] === "#") {
          if (str.length === 4) {
            var iv = parseInt(str.substr(1), 16);
            if (!(iv >= 0 && iv <= 4095)) {
              return null;
            }
            return [(iv & 3840) >> 4 | (iv & 3840) >> 8, iv & 240 | (iv & 240) >> 4, iv & 15 | (iv & 15) << 4, 1];
          } else if (str.length === 7) {
            var iv = parseInt(str.substr(1), 16);
            if (!(iv >= 0 && iv <= 16777215)) {
              return null;
            }
            return [(iv & 16711680) >> 16, (iv & 65280) >> 8, iv & 255, 1];
          } else if (str.length === 9) {
            var iv = parseInt(str.substr(1), 16);
            if (!(iv >= 0 && iv <= 4294967295)) {
              return null;
            }
            return [(iv & 4278190080) >> 24 & 255, (iv & 16711680) >> 16, (iv & 65280) >> 8, (iv & 255) / 255];
          }
          return null;
        }
        var op = str.indexOf("("), ep = str.indexOf(")");
        if (op !== -1 && ep + 1 === str.length) {
          var fname = str.substr(0, op);
          var params = str.substr(op + 1, ep - (op + 1)).split(",");
          var alpha = 1;
          switch (fname) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-expect-error
            case "rgba":
              if (params.length !== 4) {
                return null;
              }
              alpha = parseCSSFloat(params.pop());
            // Fall through.
            case "rgb":
              if (params.length !== 3) {
                return null;
              }
              return [parseCSSInt(params[0]), parseCSSInt(params[1]), parseCSSInt(params[2]), alpha];
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-expect-error
            case "hsla":
              if (params.length !== 4) {
                return null;
              }
              alpha = parseCSSFloat(params.pop());
            // Fall through.
            case "hsl":
              if (params.length !== 3) {
                return null;
              }
              var h = (parseFloat(params[0]) % 360 + 360) % 360 / 360;
              var s = parseCSSFloat(params[1]);
              var l = parseCSSFloat(params[2]);
              var m2 = l <= 0.5 ? l * (s + 1) : l + s - l * s;
              var m1 = l * 2 - m2;
              return [clampCSSByte(CSSHueToRGB(m1, m2, h + 1 / 3) * 255), clampCSSByte(CSSHueToRGB(m1, m2, h) * 255), clampCSSByte(CSSHueToRGB(m1, m2, h - 1 / 3) * 255), alpha];
            default:
              return null;
          }
        }
        return null;
      };
      Color = (color) => {
        if (color instanceof Float32Array) {
          return color;
        } else if (Array.isArray(color)) {
          return new Float32Array(color);
        } else if (typeof color === "string") {
          const r = parseCSSColor(color);
          const rgba = r === null ? CSSColorTable.black : r;
          return Float32Array.of(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, rgba[3]);
        } else {
          return Float32Array.of(red(color) / 255, green(color) / 255, blue(color) / 255, alphaf(color));
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Picture/Picture.js
  var init_Picture = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Picture/Picture.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Picture/PictureRecorder.js
  var init_PictureRecorder = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Picture/PictureRecorder.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Picture/PictureFactory.js
  var init_PictureFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Picture/PictureFactory.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Picture/index.js
  var init_Picture2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Picture/index.js"() {
      init_Picture();
      init_PictureRecorder();
      init_PictureFactory();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Data/Data.js
  var init_Data = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Data/Data.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Data/DataFactory.js
  var init_DataFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Data/DataFactory.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Data/index.js
  var init_Data2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Data/index.js"() {
      init_Data();
      init_DataFactory();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/SVG/SVG.js
  var init_SVG = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/SVG/SVG.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/SVG/SVGFactory.js
  var init_SVGFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/SVG/SVGFactory.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/SVG/index.js
  var init_SVG2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/SVG/index.js"() {
      init_SVG();
      init_SVGFactory();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Surface/Surface.js
  var init_Surface = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Surface/Surface.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Surface/SurfaceFactory.js
  var init_SurfaceFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Surface/SurfaceFactory.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Surface/index.js
  var init_Surface2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Surface/index.js"() {
      init_Surface();
      init_SurfaceFactory();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Vertices/Vertices.js
  var init_Vertices = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Vertices/Vertices.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Vertices/index.js
  var init_Vertices2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Vertices/index.js"() {
      init_Vertices();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/RuntimeEffect/RuntimeEffect.js
  var init_RuntimeEffect = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/RuntimeEffect/RuntimeEffect.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/RuntimeEffect/RuntimeEffectFactory.js
  var init_RuntimeEffectFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/RuntimeEffect/RuntimeEffectFactory.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/RuntimeEffect/index.js
  var init_RuntimeEffect2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/RuntimeEffect/index.js"() {
      init_RuntimeEffect();
      init_RuntimeEffectFactory();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Shader/Shader.js
  var init_Shader = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Shader/Shader.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Shader/ShaderFactory.js
  var init_ShaderFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Shader/ShaderFactory.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Shader/index.js
  var init_Shader2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Shader/index.js"() {
      init_Shader();
      init_ShaderFactory();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Image/Image.js
  var isCubicSampling, MitchellCubicSampling, CatmullRomCubicSampling;
  var init_Image = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Image/Image.js"() {
      isCubicSampling = (sampling) => {
        "worklet";
        return "B" in sampling && "C" in sampling;
      };
      MitchellCubicSampling = {
        B: 1 / 3,
        C: 1 / 3
      };
      CatmullRomCubicSampling = {
        B: 0,
        C: 1 / 2
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Image/ImageFactory.js
  var init_ImageFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Image/ImageFactory.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Image/ColorType.js
  var init_ColorType = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Image/ColorType.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Image/index.js
  var init_Image2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Image/index.js"() {
      init_Image();
      init_ImageFactory();
      init_ColorType();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/AnimatedImage/AnimatedImage.js
  var init_AnimatedImage = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/AnimatedImage/AnimatedImage.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/AnimatedImage/AnimatedImageFactory.js
  var init_AnimatedImageFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/AnimatedImage/AnimatedImageFactory.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/AnimatedImage/index.js
  var init_AnimatedImage2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/AnimatedImage/index.js"() {
      init_AnimatedImage();
      init_AnimatedImageFactory();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/ColorFilter/ColorFilter.js
  var init_ColorFilter = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/ColorFilter/ColorFilter.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/ColorFilter/ColorFilterFactory.js
  var init_ColorFilterFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/ColorFilter/ColorFilterFactory.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/ColorFilter/index.js
  var init_ColorFilter2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/ColorFilter/index.js"() {
      init_ColorFilter();
      init_ColorFilterFactory();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/ImageFilter/ImageFilter.js
  var init_ImageFilter = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/ImageFilter/ImageFilter.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/ImageFilter/ImageFilterFactory.js
  var init_ImageFilterFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/ImageFilter/ImageFilterFactory.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/ImageFilter/index.js
  var init_ImageFilter2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/ImageFilter/index.js"() {
      init_ImageFilter();
      init_ImageFilterFactory();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Font/Font.js
  var fontStyle, FontWeight, FontWidth, FontSlant, FontStyle;
  var init_Font = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Font/Font.js"() {
      fontStyle = (weight, width, slant) => ({
        weight,
        width,
        slant
      });
      FontWeight = /* @__PURE__ */ (function(FontWeight2) {
        FontWeight2[FontWeight2["Invisible"] = 0] = "Invisible";
        FontWeight2[FontWeight2["Thin"] = 100] = "Thin";
        FontWeight2[FontWeight2["ExtraLight"] = 200] = "ExtraLight";
        FontWeight2[FontWeight2["Light"] = 300] = "Light";
        FontWeight2[FontWeight2["Normal"] = 400] = "Normal";
        FontWeight2[FontWeight2["Medium"] = 500] = "Medium";
        FontWeight2[FontWeight2["SemiBold"] = 600] = "SemiBold";
        FontWeight2[FontWeight2["Bold"] = 700] = "Bold";
        FontWeight2[FontWeight2["ExtraBold"] = 800] = "ExtraBold";
        FontWeight2[FontWeight2["Black"] = 900] = "Black";
        FontWeight2[FontWeight2["ExtraBlack"] = 1e3] = "ExtraBlack";
        return FontWeight2;
      })({});
      FontWidth = /* @__PURE__ */ (function(FontWidth2) {
        FontWidth2[FontWidth2["UltraCondensed"] = 1] = "UltraCondensed";
        FontWidth2[FontWidth2["ExtraCondensed"] = 2] = "ExtraCondensed";
        FontWidth2[FontWidth2["Condensed"] = 3] = "Condensed";
        FontWidth2[FontWidth2["SemiCondensed"] = 4] = "SemiCondensed";
        FontWidth2[FontWidth2["Normal"] = 5] = "Normal";
        FontWidth2[FontWidth2["SemiExpanded"] = 6] = "SemiExpanded";
        FontWidth2[FontWidth2["Expanded"] = 7] = "Expanded";
        FontWidth2[FontWidth2["ExtraExpanded"] = 8] = "ExtraExpanded";
        FontWidth2[FontWidth2["UltraExpanded"] = 9] = "UltraExpanded";
        return FontWidth2;
      })({});
      FontSlant = /* @__PURE__ */ (function(FontSlant2) {
        FontSlant2[FontSlant2["Upright"] = 0] = "Upright";
        FontSlant2[FontSlant2["Italic"] = 1] = "Italic";
        FontSlant2[FontSlant2["Oblique"] = 2] = "Oblique";
        return FontSlant2;
      })({});
      FontStyle = {
        Normal: fontStyle(FontWeight.Normal, FontWidth.Normal, FontSlant.Upright),
        Bold: fontStyle(FontWeight.Bold, FontWidth.Normal, FontSlant.Upright),
        Italic: fontStyle(FontWeight.Normal, FontWidth.Normal, FontSlant.Italic),
        BoldItalic: fontStyle(FontWeight.Bold, FontWidth.Normal, FontSlant.Italic)
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Font/FontMgr.js
  var init_FontMgr = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Font/FontMgr.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Font/FontMgrFactory.js
  var init_FontMgrFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Font/FontMgrFactory.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Font/index.js
  var init_Font2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Font/index.js"() {
      init_Font();
      init_FontMgr();
      init_FontMgrFactory();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Typeface/Typeface.js
  var init_Typeface = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Typeface/Typeface.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Typeface/TypefaceFactory.js
  var init_TypefaceFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Typeface/TypefaceFactory.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Typeface/index.js
  var init_Typeface2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Typeface/index.js"() {
      init_Typeface();
      init_TypefaceFactory();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paint/Paint.js
  var init_Paint = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paint/Paint.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paint/BlendMode.js
  var init_BlendMode = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paint/BlendMode.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paint/index.js
  var init_Paint2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paint/index.js"() {
      init_Paint();
      init_BlendMode();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Path/Path.js
  var PathVerb;
  var init_Path = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Path/Path.js"() {
      PathVerb = /* @__PURE__ */ (function(PathVerb2) {
        PathVerb2[PathVerb2["Move"] = 0] = "Move";
        PathVerb2[PathVerb2["Line"] = 1] = "Line";
        PathVerb2[PathVerb2["Quad"] = 2] = "Quad";
        PathVerb2[PathVerb2["Conic"] = 3] = "Conic";
        PathVerb2[PathVerb2["Cubic"] = 4] = "Cubic";
        PathVerb2[PathVerb2["Close"] = 5] = "Close";
        return PathVerb2;
      })({});
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Path/PathBuilder.js
  var init_PathBuilder = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Path/PathBuilder.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Path/PathBuilderFactory.js
  var init_PathBuilderFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Path/PathBuilderFactory.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Path/PathFactory.js
  var init_PathFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Path/PathFactory.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Path/index.js
  var init_Path2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Path/index.js"() {
      init_Path();
      init_PathBuilder();
      init_PathBuilderFactory();
      init_PathFactory();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Color.js
  var init_Color = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Color.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Canvas.js
  var init_Canvas = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Canvas.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/ContourMeasure.js
  var init_ContourMeasure = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/ContourMeasure.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/MaskFilter.js
  var init_MaskFilter = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/MaskFilter.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Matrix4.js
  var toMatrix3;
  var init_Matrix4 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Matrix4.js"() {
      toMatrix3 = (m) => {
        "worklet";
        return [m[0], m[1], m[3], m[4], m[5], m[7], m[12], m[13], m[15]];
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Matrix.js
  var init_Matrix = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Matrix.js"() {
      init_Matrix4();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/PathEffect.js
  var init_PathEffect = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/PathEffect.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Point.js
  var init_Point = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Point.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Rect.js
  var init_Rect = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Rect.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/RRect.js
  var init_RRect = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/RRect.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/RSXform.js
  var init_RSXform = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/RSXform.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/JsiInstance.js
  var init_JsiInstance = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/JsiInstance.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Skia.js
  var init_Skia = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Skia.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/TextBlob.js
  var init_TextBlob = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/TextBlob.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Size.js
  var init_Size = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Size.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paragraph/TypefaceFontProvider.js
  var init_TypefaceFontProvider = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paragraph/TypefaceFontProvider.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paragraph/TypefaceFontProviderFactory.js
  var init_TypefaceFontProviderFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paragraph/TypefaceFontProviderFactory.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paragraph/Paragraph.js
  var init_Paragraph = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paragraph/Paragraph.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paragraph/ParagraphBuilder.js
  var PlaceholderAlignment;
  var init_ParagraphBuilder = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paragraph/ParagraphBuilder.js"() {
      PlaceholderAlignment = /* @__PURE__ */ (function(PlaceholderAlignment2) {
        PlaceholderAlignment2[PlaceholderAlignment2["Baseline"] = 0] = "Baseline";
        PlaceholderAlignment2[PlaceholderAlignment2["AboveBaseline"] = 1] = "AboveBaseline";
        PlaceholderAlignment2[PlaceholderAlignment2["BelowBaseline"] = 2] = "BelowBaseline";
        PlaceholderAlignment2[PlaceholderAlignment2["Top"] = 3] = "Top";
        PlaceholderAlignment2[PlaceholderAlignment2["Bottom"] = 4] = "Bottom";
        PlaceholderAlignment2[PlaceholderAlignment2["Middle"] = 5] = "Middle";
        return PlaceholderAlignment2;
      })({});
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paragraph/ParagraphStyle.js
  var TextDirection;
  var init_ParagraphStyle = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paragraph/ParagraphStyle.js"() {
      TextDirection = /* @__PURE__ */ (function(TextDirection2) {
        TextDirection2[TextDirection2["RTL"] = 0] = "RTL";
        TextDirection2[TextDirection2["LTR"] = 1] = "LTR";
        return TextDirection2;
      })({});
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paragraph/TextStyle.js
  var TextBaseline;
  var init_TextStyle = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paragraph/TextStyle.js"() {
      TextBaseline = /* @__PURE__ */ (function(TextBaseline2) {
        TextBaseline2[TextBaseline2["Alphabetic"] = 0] = "Alphabetic";
        TextBaseline2[TextBaseline2["Ideographic"] = 1] = "Ideographic";
        return TextBaseline2;
      })({});
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paragraph/index.js
  var init_Paragraph2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Paragraph/index.js"() {
      init_TypefaceFontProvider();
      init_TypefaceFontProviderFactory();
      init_Paragraph();
      init_ParagraphBuilder();
      init_ParagraphStyle();
      init_TextStyle();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/NativeBuffer/NativeBufferFactory.js
  var CanvasKitWebGLBuffer, isNativeBufferWeb;
  var init_NativeBufferFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/NativeBuffer/NativeBufferFactory.js"() {
      CanvasKitWebGLBuffer = class {
      };
      isNativeBufferWeb = (buffer) => buffer instanceof HTMLVideoElement || buffer instanceof HTMLCanvasElement || buffer instanceof ImageBitmap || buffer instanceof OffscreenCanvas || typeof VideoFrame !== "undefined" && buffer instanceof VideoFrame || buffer instanceof HTMLImageElement || buffer instanceof SVGImageElement || buffer instanceof CanvasKitWebGLBuffer;
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/NativeBuffer/index.js
  var init_NativeBuffer = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/NativeBuffer/index.js"() {
      init_NativeBufferFactory();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Recorder.js
  var init_Recorder = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Recorder.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Video/Video.js
  var init_Video = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Video/Video.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Video/index.js
  var init_Video2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Video/index.js"() {
      init_Video();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Skottie.js
  var init_Skottie = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/Skottie.js"() {
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/index.js
  var init_types2 = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/types/index.js"() {
      init_Picture2();
      init_Data2();
      init_SVG2();
      init_Surface2();
      init_Vertices2();
      init_RuntimeEffect2();
      init_Shader2();
      init_Image2();
      init_AnimatedImage2();
      init_ColorFilter2();
      init_ImageFilter2();
      init_Font2();
      init_Typeface2();
      init_Paint2();
      init_Path2();
      init_Color();
      init_Canvas();
      init_ContourMeasure();
      init_MaskFilter();
      init_Matrix();
      init_PathEffect();
      init_Point();
      init_Rect();
      init_RRect();
      init_RSXform();
      init_JsiInstance();
      init_Skia();
      init_TextBlob();
      init_Size();
      init_Paragraph2();
      init_Matrix4();
      init_NativeBuffer();
      init_Recorder();
      init_Video2();
      init_Skottie();
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkRRect.js
  var JsiSkRRect;
  var init_JsiSkRRect = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkRRect.js"() {
      init_Host();
      init_JsiSkRect();
      JsiSkRRect = class extends BaseHostObject {
        [Symbol.dispose]() {
        }
        static fromValue(CanvasKit, rect) {
          if (rect instanceof JsiSkRect) {
            return rect.ref;
          }
          if ("topLeft" in rect && "topRight" in rect && "bottomRight" in rect && "bottomLeft" in rect) {
            return Float32Array.of(rect.rect.x, rect.rect.y, rect.rect.x + rect.rect.width, rect.rect.y + rect.rect.height, rect.topLeft.x, rect.topLeft.y, rect.topRight.x, rect.topRight.y, rect.bottomRight.x, rect.bottomRight.y, rect.bottomLeft.x, rect.bottomLeft.y);
          }
          return CanvasKit.RRectXY(JsiSkRect.fromValue(CanvasKit, rect.rect), rect.rx, rect.ry);
        }
        constructor(CanvasKit, rect, rx, ry) {
          if (rx === Infinity || ry === Infinity) {
            rx = ry = 0;
          }
          if (rect.width < rx + rx || rect.height < ry + ry) {
            const scale = Math.min(rect.width / (rx + rx), rect.height / (ry + ry));
            rx *= scale;
            ry *= scale;
          }
          const ref = CanvasKit.RRectXY(JsiSkRect.fromValue(CanvasKit, rect), rx, ry);
          super(CanvasKit, ref, "RRect");
        }
        get rx() {
          return this.ref[4];
        }
        get ry() {
          return this.ref[5];
        }
        get rect() {
          return new JsiSkRect(this.CanvasKit, Float32Array.of(this.ref[0], this.ref[1], this.ref[2], this.ref[3]));
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkMatrix.js
  var isMatrixHostObject, JsiSkMatrix;
  var init_JsiSkMatrix = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkMatrix.js"() {
      init_types2();
      init_Host();
      isMatrixHostObject = (obj) => !Array.isArray(obj);
      JsiSkMatrix = class _JsiSkMatrix extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "Matrix");
        }
        preMultiply(matrix) {
          this.ref.set(this.CanvasKit.Matrix.multiply(this.ref, matrix));
        }
        postMultiply(matrix) {
          this.ref.set(this.CanvasKit.Matrix.multiply(matrix, this.ref));
        }
        concat(matrix) {
          this.preMultiply(
            // eslint-disable-next-line no-nested-ternary
            isMatrixHostObject(matrix) ? _JsiSkMatrix.fromValue(matrix) : matrix.length === 16 ? toMatrix3(matrix) : [...matrix]
          );
          return this;
        }
        translate(x, y) {
          this.preMultiply(this.CanvasKit.Matrix.translated(x, y));
          return this;
        }
        postTranslate(x, y) {
          this.postMultiply(this.CanvasKit.Matrix.translated(x, y));
          return this;
        }
        scale(x, y) {
          this.preMultiply(this.CanvasKit.Matrix.scaled(x, y !== null && y !== void 0 ? y : x));
          return this;
        }
        postScale(x, y) {
          this.postMultiply(this.CanvasKit.Matrix.scaled(x, y !== null && y !== void 0 ? y : x));
          return this;
        }
        skew(x, y) {
          this.preMultiply(this.CanvasKit.Matrix.skewed(x, y));
          return this;
        }
        postSkew(x, y) {
          this.postMultiply(this.CanvasKit.Matrix.skewed(x, y));
          return this;
        }
        rotate(value) {
          this.preMultiply(this.CanvasKit.Matrix.rotated(value));
          return this;
        }
        postRotate(value) {
          this.postMultiply(this.CanvasKit.Matrix.rotated(value));
          return this;
        }
        identity() {
          this.ref.set(this.CanvasKit.Matrix.identity());
          return this;
        }
        get() {
          return Array.from(this.ref);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkImage.js
  var toBase64String, JsiSkImage;
  var init_JsiSkImage = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkImage.js"() {
      init_Host();
      init_JsiSkMatrix();
      init_JsiSkShader();
      toBase64String = (bytes) => {
        if (typeof Buffer !== "undefined") {
          return Buffer.from(bytes).toString("base64");
        } else {
          var CHUNK_SIZE = 32768;
          var index = 0;
          var {
            length
          } = bytes;
          var result = "";
          var slice;
          while (index < length) {
            slice = bytes.slice(index, Math.min(index + CHUNK_SIZE, length));
            result += String.fromCharCode.apply(null, slice);
            index += CHUNK_SIZE;
          }
          return btoa(result);
        }
      };
      JsiSkImage = class _JsiSkImage extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "Image");
        }
        height() {
          return this.ref.height();
        }
        width() {
          return this.ref.width();
        }
        getImageInfo() {
          const info = this.ref.getImageInfo();
          return {
            width: info.width,
            height: info.height,
            colorType: info.colorType.value,
            alphaType: info.alphaType.value
          };
        }
        makeShaderOptions(tx, ty, fm, mm, localMatrix) {
          return new JsiSkShader(this.CanvasKit, this.ref.makeShaderOptions(getEnum(this.CanvasKit, "TileMode", tx), getEnum(this.CanvasKit, "TileMode", ty), getEnum(this.CanvasKit, "FilterMode", fm), getEnum(this.CanvasKit, "MipmapMode", mm), localMatrix ? JsiSkMatrix.fromValue(localMatrix) : void 0));
        }
        makeShaderCubic(tx, ty, B, C, localMatrix) {
          return new JsiSkShader(this.CanvasKit, this.ref.makeShaderCubic(getEnum(this.CanvasKit, "TileMode", tx), getEnum(this.CanvasKit, "TileMode", ty), B, C, localMatrix ? JsiSkMatrix.fromValue(localMatrix) : void 0));
        }
        encodeToBytes(fmt, quality) {
          let result;
          if (fmt && quality) {
            result = this.ref.encodeToBytes(getEnum(this.CanvasKit, "ImageFormat", fmt), quality);
          } else if (fmt) {
            result = this.ref.encodeToBytes(getEnum(this.CanvasKit, "ImageFormat", fmt));
          } else {
            result = this.ref.encodeToBytes();
          }
          if (!result) {
            throw new Error("encodeToBytes failed");
          }
          return result;
        }
        encodeToBase64(fmt, quality) {
          const bytes = this.encodeToBytes(fmt, quality);
          return toBase64String(bytes);
        }
        // TODO: this is leaking on Web
        // Add signature with allocated buffer
        readPixels(srcX, srcY, imageInfo) {
          var _imageInfo$width, _imageInfo$height;
          const info = this.getImageInfo();
          const pxInfo = {
            colorSpace: this.CanvasKit.ColorSpace.SRGB,
            width: (_imageInfo$width = imageInfo === null || imageInfo === void 0 ? void 0 : imageInfo.width) !== null && _imageInfo$width !== void 0 ? _imageInfo$width : info.width,
            height: (_imageInfo$height = imageInfo === null || imageInfo === void 0 ? void 0 : imageInfo.height) !== null && _imageInfo$height !== void 0 ? _imageInfo$height : info.height,
            alphaType: getEnum(this.CanvasKit, "AlphaType", (imageInfo !== null && imageInfo !== void 0 ? imageInfo : info).alphaType),
            colorType: getEnum(this.CanvasKit, "ColorType", (imageInfo !== null && imageInfo !== void 0 ? imageInfo : info).colorType)
          };
          return this.ref.readPixels(srcX !== null && srcX !== void 0 ? srcX : 0, srcY !== null && srcY !== void 0 ? srcY : 0, pxInfo);
        }
        makeNonTextureImage() {
          const partialInfo = this.ref.getImageInfo();
          const colorSpace = this.ref.getColorSpace();
          const info = {
            ...partialInfo,
            colorSpace
          };
          const pixels = this.ref.readPixels(0, 0, info);
          if (!pixels) {
            throw new Error("Could not read pixels from image");
          }
          const img = this.CanvasKit.MakeImage(info, pixels, info.width * 4);
          if (!img) {
            throw new Error("Could not create image from bytes");
          }
          return new _JsiSkImage(this.CanvasKit, img);
        }
        getNativeTextureUnstable() {
          console.warn("getBackendTexture is not implemented on Web");
          return null;
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkVertices.js
  var JsiSkVertices;
  var init_JsiSkVertices = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkVertices.js"() {
      init_Host();
      init_JsiSkRect();
      JsiSkVertices = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "Vertices");
        }
        bounds() {
          return new JsiSkRect(this.CanvasKit, this.ref.bounds());
        }
        uniqueID() {
          return this.ref.uniqueID();
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPath.js
  var CommandCount, shownDeprecationWarnings, warnDeprecatedPathMethod, toMatrix3x3, JsiSkPath;
  var init_JsiSkPath = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPath.js"() {
      init_types2();
      init_Host();
      init_JsiSkPoint();
      init_JsiSkRect();
      init_JsiSkRRect();
      init_JsiSkMatrix();
      CommandCount = {
        [PathVerb.Move]: 3,
        [PathVerb.Line]: 3,
        [PathVerb.Quad]: 5,
        [PathVerb.Conic]: 6,
        [PathVerb.Cubic]: 7,
        [PathVerb.Close]: 1
      };
      shownDeprecationWarnings = /* @__PURE__ */ new Set();
      warnDeprecatedPathMethod = (methodName, suggestion) => {
        if (shownDeprecationWarnings.has(methodName)) {
          return;
        }
        shownDeprecationWarnings.add(methodName);
        console.warn(`[react-native-skia] SkPath.${methodName}() is deprecated and will be removed in a future release. ${suggestion} See migration guide: https://shopify.github.io/react-native-skia/docs/shapes/path-migration`);
      };
      toMatrix3x3 = (m) => {
        let matrix = m instanceof JsiSkMatrix ? Array.from(JsiSkMatrix.fromValue(m)) : m;
        if (matrix.length === 16) {
          matrix = [matrix[0], matrix[1], matrix[3], matrix[4], matrix[5], matrix[7], matrix[12], matrix[13], matrix[15]];
        } else if (matrix.length !== 9) {
          throw new Error(`Invalid matrix length: ${matrix.length}`);
        }
        return matrix;
      };
      JsiSkPath = class _JsiSkPath extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "Path");
        }
        /** Returns an immutable CK Path snapshot for read-only operations. */
        asPath() {
          return this.ref.snapshot();
        }
        /** Extract an immutable CK Path from a JsiSkPath value (for CK interop). */
        static pathFromValue(value) {
          return _JsiSkPath.fromValue(value).snapshot();
        }
        // ---- Mutable building methods (deprecated) ----
        addPath(src, matrix, extend = false) {
          warnDeprecatedPathMethod("addPath", "Use Skia.PathBuilder.Make().addPath() instead.");
          const srcBuilder = _JsiSkPath.fromValue(src);
          const srcPath = srcBuilder.snapshot();
          const args = [srcPath, ...matrix ? JsiSkMatrix.fromValue(matrix) : [], extend];
          this.ref.addPath(...args);
          srcPath.delete();
          return this;
        }
        addArc(oval, startAngleInDegrees, sweepAngleInDegrees) {
          warnDeprecatedPathMethod("addArc", "Use Skia.PathBuilder.Make().addArc() instead.");
          this.ref.addArc(JsiSkRect.fromValue(this.CanvasKit, oval), startAngleInDegrees, sweepAngleInDegrees);
          return this;
        }
        addOval(oval, isCCW, startIndex) {
          warnDeprecatedPathMethod("addOval", "Use Skia.Path.Oval() or Skia.PathBuilder.Make().addOval() instead.");
          this.ref.addOval(JsiSkRect.fromValue(this.CanvasKit, oval), isCCW, startIndex);
          return this;
        }
        addPoly(points, close) {
          warnDeprecatedPathMethod("addPoly", "Use Skia.Path.Polygon() or Skia.PathBuilder.Make().addPoly() instead.");
          this.ref.addPolygon(points.map((p) => Array.from(JsiSkPoint.fromValue(p))).flat(), close);
          return this;
        }
        addRect(rect, isCCW) {
          warnDeprecatedPathMethod("addRect", "Use Skia.Path.Rect() or Skia.PathBuilder.Make().addRect() instead.");
          this.ref.addRect(JsiSkRect.fromValue(this.CanvasKit, rect), isCCW);
          return this;
        }
        addRRect(rrect, isCCW) {
          warnDeprecatedPathMethod("addRRect", "Use Skia.Path.RRect() or Skia.PathBuilder.Make().addRRect() instead.");
          this.ref.addRRect(JsiSkRRect.fromValue(this.CanvasKit, rrect), isCCW);
          return this;
        }
        addCircle(x, y, r) {
          warnDeprecatedPathMethod("addCircle", "Use Skia.Path.Circle() or Skia.PathBuilder.Make().addCircle() instead.");
          this.ref.addCircle(x, y, r);
          return this;
        }
        moveTo(x, y) {
          warnDeprecatedPathMethod("moveTo", "Use Skia.PathBuilder.Make().moveTo() instead.");
          this.ref.moveTo(x, y);
          return this;
        }
        rMoveTo(x, y) {
          warnDeprecatedPathMethod("rMoveTo", "Use Skia.PathBuilder.Make().rMoveTo() instead.");
          this.ref.rMoveTo(x, y);
          return this;
        }
        lineTo(x, y) {
          warnDeprecatedPathMethod("lineTo", "Use Skia.PathBuilder.Make().lineTo() instead.");
          this.ref.lineTo(x, y);
          return this;
        }
        rLineTo(x, y) {
          warnDeprecatedPathMethod("rLineTo", "Use Skia.PathBuilder.Make().rLineTo() instead.");
          this.ref.rLineTo(x, y);
          return this;
        }
        quadTo(x1, y1, x2, y2) {
          warnDeprecatedPathMethod("quadTo", "Use Skia.PathBuilder.Make().quadTo() instead.");
          this.ref.quadTo(x1, y1, x2, y2);
          return this;
        }
        rQuadTo(x1, y1, x2, y2) {
          warnDeprecatedPathMethod("rQuadTo", "Use Skia.PathBuilder.Make().rQuadTo() instead.");
          this.ref.rQuadTo(x1, y1, x2, y2);
          return this;
        }
        conicTo(x1, y1, x2, y2, w) {
          warnDeprecatedPathMethod("conicTo", "Use Skia.PathBuilder.Make().conicTo() instead.");
          this.ref.conicTo(x1, y1, x2, y2, w);
          return this;
        }
        rConicTo(x1, y1, x2, y2, w) {
          warnDeprecatedPathMethod("rConicTo", "Use Skia.PathBuilder.Make().rConicTo() instead.");
          this.ref.rConicTo(x1, y1, x2, y2, w);
          return this;
        }
        cubicTo(cpx1, cpy1, cpx2, cpy2, x, y) {
          warnDeprecatedPathMethod("cubicTo", "Use Skia.PathBuilder.Make().cubicTo() instead.");
          this.ref.cubicTo(cpx1, cpy1, cpx2, cpy2, x, y);
          return this;
        }
        rCubicTo(cpx1, cpy1, cpx2, cpy2, x, y) {
          warnDeprecatedPathMethod("rCubicTo", "Use Skia.PathBuilder.Make().rCubicTo() instead.");
          this.ref.rCubicTo(cpx1, cpy1, cpx2, cpy2, x, y);
          return this;
        }
        close() {
          warnDeprecatedPathMethod("close", "Use Skia.PathBuilder.Make().close() instead.");
          this.ref.close();
          return this;
        }
        reset() {
          warnDeprecatedPathMethod("reset", "Use Skia.PathBuilder.Make().reset() instead.");
          const newBuilder = new this.CanvasKit.PathBuilder();
          if (this.ref !== null && typeof this.ref === "object" && "delete" in this.ref && typeof this.ref.delete === "function") {
            this.ref.delete();
          }
          this.ref = newBuilder;
          return this;
        }
        rewind() {
          warnDeprecatedPathMethod("rewind", "Use Skia.PathBuilder.Make().reset() instead.");
          return this.reset();
        }
        arcToOval(oval, startAngleInDegrees, sweepAngleInDegrees, forceMoveTo) {
          warnDeprecatedPathMethod("arcToOval", "Use Skia.PathBuilder.Make().arcToOval() instead.");
          this.ref.arcToOval(JsiSkRect.fromValue(this.CanvasKit, oval), startAngleInDegrees, sweepAngleInDegrees, forceMoveTo);
          return this;
        }
        arcToRotated(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, x, y) {
          warnDeprecatedPathMethod("arcToRotated", "Use Skia.PathBuilder.Make().arcToRotated() instead.");
          this.ref.arcToRotated(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, x, y);
          return this;
        }
        rArcTo(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, dx, dy) {
          warnDeprecatedPathMethod("rArcTo", "Use Skia.PathBuilder.Make().rArcTo() instead.");
          this.ref.rArcTo(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, dx, dy);
          return this;
        }
        arcToTangent(x1, y1, x2, y2, radius) {
          warnDeprecatedPathMethod("arcToTangent", "Use Skia.PathBuilder.Make().arcToTangent() instead.");
          this.ref.arcToTangent(x1, y1, x2, y2, radius);
          return this;
        }
        setFillType(fill) {
          warnDeprecatedPathMethod("setFillType", "Use Skia.PathBuilder.Make().setFillType() instead.");
          this.ref.setFillType(getEnum(this.CanvasKit, "FillType", fill));
          return this;
        }
        setIsVolatile(_volatile) {
          warnDeprecatedPathMethod("setIsVolatile", "Use Skia.PathBuilder.Make().setIsVolatile() instead.");
          return this;
        }
        // ---- Mutable path operations (deprecated) ----
        offset(dx, dy) {
          warnDeprecatedPathMethod("offset", "Use Skia.PathBuilder.Make().offset() instead.");
          this.ref.offset(dx, dy);
          return this;
        }
        transform(m) {
          warnDeprecatedPathMethod("transform", "Use Skia.PathBuilder.Make().transform() instead.");
          const matrix = toMatrix3x3(m);
          this.ref.transform(matrix);
          return this;
        }
        makeAsWinding() {
          warnDeprecatedPathMethod("makeAsWinding", "Use Skia.Path.AsWinding(path) instead.");
          const path = this.asPath();
          const result = path.makeAsWinding();
          path.delete();
          if (result === null) {
            return null;
          }
          const old = this.ref;
          this.ref = new this.CanvasKit.PathBuilder(result);
          result.delete();
          old.delete();
          return this;
        }
        simplify() {
          warnDeprecatedPathMethod("simplify", "Use Skia.Path.Simplify(path) instead.");
          const path = this.asPath();
          const result = path.makeSimplified();
          path.delete();
          if (result === null) {
            return false;
          }
          const old = this.ref;
          this.ref = new this.CanvasKit.PathBuilder(result);
          result.delete();
          old.delete();
          return true;
        }
        op(path, op) {
          warnDeprecatedPathMethod("op", "Use Skia.Path.MakeFromOp() instead.");
          const self = this.asPath();
          const other = _JsiSkPath.fromValue(path).snapshot();
          const result = self.makeCombined(other, getEnum(this.CanvasKit, "PathOp", op));
          self.delete();
          other.delete();
          if (result === null) {
            return false;
          }
          const old = this.ref;
          this.ref = new this.CanvasKit.PathBuilder(result);
          result.delete();
          old.delete();
          return true;
        }
        dash(on, off, phase) {
          warnDeprecatedPathMethod("dash", "Use Skia.Path.Dash(path, on, off, phase) instead.");
          const path = this.asPath();
          const result = path.makeDashed(on, off, phase);
          path.delete();
          if (result === null) {
            return false;
          }
          const old = this.ref;
          this.ref = new this.CanvasKit.PathBuilder(result);
          result.delete();
          old.delete();
          return true;
        }
        stroke(opts) {
          warnDeprecatedPathMethod("stroke", "Use Skia.Path.Stroke(path, opts) instead.");
          const path = this.asPath();
          const result = path.makeStroked(opts === void 0 ? void 0 : {
            width: opts.width,
            // eslint-disable-next-line camelcase
            miter_limit: opts.miter_limit,
            precision: opts.precision,
            join: optEnum(this.CanvasKit, "StrokeJoin", opts.join),
            cap: optEnum(this.CanvasKit, "StrokeCap", opts.cap)
          });
          path.delete();
          if (result === null) {
            return null;
          }
          const old = this.ref;
          this.ref = new this.CanvasKit.PathBuilder(result);
          result.delete();
          old.delete();
          return this;
        }
        trim(start, stop, isComplement) {
          warnDeprecatedPathMethod("trim", "Use Skia.Path.Trim(path, start, end, isComplement) instead.");
          const startT = Math.min(Math.max(start, 0), 1);
          const stopT = Math.min(Math.max(stop, 0), 1);
          if (startT === 0 && stopT === 1 && !isComplement) {
            return this;
          }
          const path = this.asPath();
          const result = path.makeTrimmed(startT, stopT, isComplement);
          path.delete();
          if (result === null) {
            return null;
          }
          const old = this.ref;
          this.ref = new this.CanvasKit.PathBuilder(result);
          result.delete();
          old.delete();
          return this;
        }
        // ---- Query methods (use snapshot for read-only) ----
        countPoints() {
          return this.ref.countPoints();
        }
        computeTightBounds() {
          const path = this.asPath();
          const result = new JsiSkRect(this.CanvasKit, path.computeTightBounds());
          path.delete();
          return result;
        }
        contains(x, y) {
          const path = this.asPath();
          const result = path.contains(x, y);
          path.delete();
          return result;
        }
        copy() {
          const path = this.asPath();
          const result = new _JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
          path.delete();
          return result;
        }
        equals(other) {
          const p1 = this.asPath();
          const p2 = _JsiSkPath.fromValue(other).snapshot();
          const result = p1.equals(p2);
          p1.delete();
          p2.delete();
          return result;
        }
        getBounds() {
          return new JsiSkRect(this.CanvasKit, this.ref.getBounds());
        }
        getFillType() {
          const path = this.asPath();
          const result = path.getFillType().value;
          path.delete();
          return result;
        }
        getPoint(index) {
          const path = this.asPath();
          const result = new JsiSkPoint(this.CanvasKit, path.getPoint(index));
          path.delete();
          return result;
        }
        isEmpty() {
          return this.ref.isEmpty();
        }
        isVolatile() {
          return false;
        }
        getLastPt() {
          const count = this.ref.countPoints();
          if (count === 0) {
            return {
              x: 0,
              y: 0
            };
          }
          const path = this.asPath();
          const pt = path.getPoint(count - 1);
          path.delete();
          return {
            x: pt[0],
            y: pt[1]
          };
        }
        toSVGString() {
          const path = this.asPath();
          const result = path.toSVGString();
          path.delete();
          return result;
        }
        isInterpolatable(path2) {
          const p1 = this.asPath();
          const p2 = _JsiSkPath.fromValue(path2).snapshot();
          const result = this.CanvasKit.Path.CanInterpolate(p1, p2);
          p1.delete();
          p2.delete();
          return result;
        }
        interpolate(end, weight, output) {
          const p1 = this.asPath();
          const p2 = _JsiSkPath.fromValue(end).snapshot();
          const path = this.CanvasKit.Path.MakeFromPathInterpolation(p1, p2, weight);
          p1.delete();
          p2.delete();
          if (path === null) {
            return null;
          }
          if (output) {
            const outRef = output;
            const old = outRef.ref;
            outRef.ref = new this.CanvasKit.PathBuilder(path);
            path.delete();
            old.delete();
            return output;
          }
          const result = new _JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
          path.delete();
          return result;
        }
        toCmds() {
          const path = this.asPath();
          const cmds = path.toCmds();
          path.delete();
          const result = cmds.reduce((acc, cmd, i) => {
            if (i === 0) {
              acc.push([]);
            }
            const current = acc[acc.length - 1];
            if (current.length === 0) {
              current.push(cmd);
              const length = CommandCount[current[0]];
              if (current.length === length && i !== cmds.length - 1) {
                acc.push([]);
              }
            } else {
              const length = CommandCount[current[0]];
              if (current.length < length) {
                current.push(cmd);
              }
              if (current.length === length && i !== cmds.length - 1) {
                acc.push([]);
              }
            }
            return acc;
          }, []);
          return result;
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkTypeface.js
  var JsiSkTypeface;
  var init_JsiSkTypeface = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkTypeface.js"() {
      init_Host();
      JsiSkTypeface = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "Typeface");
        }
        get bold() {
          console.warn("Typeface.bold is deprecated and will be removed in a future release. The property will return false.");
          return false;
        }
        get italic() {
          console.warn("Typeface.italic is deprecated and will be removed in a future release. The property will return false.");
          return false;
        }
        getGlyphIDs(str, numCodePoints) {
          return Array.from(this.ref.getGlyphIDs(str, numCodePoints));
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkFont.js
  var JsiSkFont;
  var init_JsiSkFont = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkFont.js"() {
      init_Host();
      init_JsiSkPaint();
      init_JsiSkPoint();
      init_JsiSkRect();
      init_JsiSkTypeface();
      JsiSkFont = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "Font");
        }
        measureText(_text, _paint) {
          return throwNotImplementedOnRNWeb();
        }
        getTextWidth(text, paint) {
          const ids = this.getGlyphIDs(text);
          const widths = this.getGlyphWidths(ids, paint);
          return widths.reduce((a, b) => a + b, 0);
        }
        getMetrics() {
          const result = this.ref.getMetrics();
          return {
            ascent: result.ascent,
            descent: result.descent,
            leading: result.leading,
            bounds: result.bounds ? new JsiSkRect(this.CanvasKit, result.bounds) : void 0
          };
        }
        getGlyphIDs(str, numCodePoints) {
          return [...this.ref.getGlyphIDs(str, numCodePoints)];
        }
        // TODO: Fix return value in the C++ implementation, it return float32
        getGlyphWidths(glyphs, paint) {
          return [...this.ref.getGlyphWidths(glyphs, paint ? JsiSkPaint.fromValue(paint) : null)];
        }
        getGlyphIntercepts(glyphs, positions, top, bottom) {
          return [...this.ref.getGlyphIntercepts(glyphs, positions.map((p) => Array.from(JsiSkPoint.fromValue(p))).flat(), top, bottom)];
        }
        getScaleX() {
          return this.ref.getScaleX();
        }
        getSize() {
          return this.ref.getSize();
        }
        getSkewX() {
          return this.ref.getSkewX();
        }
        isEmbolden() {
          return this.ref.isEmbolden();
        }
        getTypeface() {
          const tf = this.ref.getTypeface();
          return tf ? new JsiSkTypeface(this.CanvasKit, tf) : null;
        }
        setEdging(edging) {
          this.ref.setEdging(getEnum(this.CanvasKit, "FontEdging", edging));
        }
        setEmbeddedBitmaps(embeddedBitmaps) {
          this.ref.setEmbeddedBitmaps(embeddedBitmaps);
        }
        setHinting(hinting) {
          this.ref.setHinting(getEnum(this.CanvasKit, "FontHinting", hinting));
        }
        setLinearMetrics(linearMetrics) {
          this.ref.setLinearMetrics(linearMetrics);
        }
        setScaleX(sx) {
          this.ref.setScaleX(sx);
        }
        setSize(points) {
          this.ref.setSize(points);
        }
        setSkewX(sx) {
          this.ref.setSkewX(sx);
        }
        setEmbolden(embolden) {
          this.ref.setEmbolden(embolden);
        }
        setSubpixel(subpixel) {
          this.ref.setSubpixel(subpixel);
        }
        setTypeface(face) {
          this.ref.setTypeface(face ? JsiSkTypeface.fromValue(face) : null);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkTextBlob.js
  var JsiSkTextBlob;
  var init_JsiSkTextBlob = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkTextBlob.js"() {
      init_Host();
      JsiSkTextBlob = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "TextBlob");
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPicture.js
  var JsiSkPicture;
  var init_JsiSkPicture = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPicture.js"() {
      init_Host();
      init_JsiSkShader();
      init_JsiSkMatrix();
      init_JsiSkRect();
      JsiSkPicture = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "Picture");
        }
        makeShader(tmx, tmy, mode, localMatrix, tileRect) {
          return new JsiSkShader(this.CanvasKit, this.ref.makeShader(getEnum(this.CanvasKit, "TileMode", tmx), getEnum(this.CanvasKit, "TileMode", tmy), getEnum(this.CanvasKit, "FilterMode", mode), localMatrix ? JsiSkMatrix.fromValue(localMatrix) : void 0, tileRect ? JsiSkRect.fromValue(this.CanvasKit, tileRect) : void 0));
        }
        serialize() {
          return this.ref.serialize();
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkRSXform.js
  var JsiSkRSXform;
  var init_JsiSkRSXform = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkRSXform.js"() {
      init_Host();
      JsiSkRSXform = class _JsiSkRSXform extends BaseHostObject {
        static fromValue(rsxform) {
          if (rsxform instanceof _JsiSkRSXform) {
            return rsxform.ref;
          }
          return Float32Array.of(rsxform.scos, rsxform.ssin, rsxform.tx, rsxform.ty);
        }
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "RSXform");
        }
        set(scos, ssin, tx, ty) {
          this.ref[0] = scos;
          this.ref[1] = ssin;
          this.ref[2] = tx;
          this.ref[3] = ty;
        }
        get scos() {
          return this.ref[0];
        }
        get ssin() {
          return this.ref[1];
        }
        get tx() {
          return this.ref[2];
        }
        get ty() {
          return this.ref[3];
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkCanvas.js
  var JsiSkCanvas;
  var init_JsiSkCanvas = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkCanvas.js"() {
      init_types2();
      init_Host();
      init_JsiSkPaint();
      init_JsiSkRect();
      init_JsiSkRRect();
      init_JsiSkImage();
      init_JsiSkVertices();
      init_JsiSkPath();
      init_JsiSkFont();
      init_JsiSkTextBlob();
      init_JsiSkPicture();
      init_JsiSkMatrix();
      init_JsiSkImageFilter();
      init_JsiSkPoint();
      init_JsiSkRSXform();
      JsiSkCanvas = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "Canvas");
        }
        drawRect(rect, paint) {
          this.ref.drawRect(JsiSkRect.fromValue(this.CanvasKit, rect), JsiSkPaint.fromValue(paint));
        }
        drawImage(image, x, y, paint) {
          this.ref.drawImage(JsiSkImage.fromValue(image), x, y, paint ? JsiSkPaint.fromValue(paint) : paint);
        }
        drawImageRect(img, src, dest, paint, fastSample) {
          this.ref.drawImageRect(JsiSkImage.fromValue(img), JsiSkRect.fromValue(this.CanvasKit, src), JsiSkRect.fromValue(this.CanvasKit, dest), JsiSkPaint.fromValue(paint), fastSample);
        }
        drawImageCubic(img, left, top, B, C, paint) {
          this.ref.drawImageCubic(JsiSkImage.fromValue(img), left, top, B, C, paint ? JsiSkPaint.fromValue(paint) : paint);
        }
        drawImageOptions(img, left, top, fm, mm, paint) {
          this.ref.drawImageOptions(JsiSkImage.fromValue(img), left, top, getEnum(this.CanvasKit, "FilterMode", fm), getEnum(this.CanvasKit, "MipmapMode", mm), paint ? JsiSkPaint.fromValue(paint) : paint);
        }
        drawImageNine(img, center, dest, filter, paint) {
          this.ref.drawImageNine(JsiSkImage.fromValue(img), Array.from(JsiSkRect.fromValue(this.CanvasKit, center)), JsiSkRect.fromValue(this.CanvasKit, dest), getEnum(this.CanvasKit, "FilterMode", filter), paint ? JsiSkPaint.fromValue(paint) : paint);
        }
        drawImageRectCubic(img, src, dest, B, C, paint) {
          this.ref.drawImageRectCubic(JsiSkImage.fromValue(img), JsiSkRect.fromValue(this.CanvasKit, src), JsiSkRect.fromValue(this.CanvasKit, dest), B, C, paint ? JsiSkPaint.fromValue(paint) : paint);
        }
        drawImageRectOptions(img, src, dest, fm, mm, paint) {
          this.ref.drawImageRectOptions(JsiSkImage.fromValue(img), JsiSkRect.fromValue(this.CanvasKit, src), JsiSkRect.fromValue(this.CanvasKit, dest), getEnum(this.CanvasKit, "FilterMode", fm), getEnum(this.CanvasKit, "MipmapMode", mm), paint ? JsiSkPaint.fromValue(paint) : paint);
        }
        drawPaint(paint) {
          this.ref.drawPaint(JsiSkPaint.fromValue(paint));
        }
        drawLine(x0, y0, x1, y1, paint) {
          this.ref.drawLine(x0, y0, x1, y1, JsiSkPaint.fromValue(paint));
        }
        drawCircle(cx, cy, radius, paint) {
          this.ref.drawCircle(cx, cy, radius, JsiSkPaint.fromValue(paint));
        }
        drawVertices(verts, mode, paint) {
          this.ref.drawVertices(JsiSkVertices.fromValue(verts), getEnum(this.CanvasKit, "BlendMode", mode), JsiSkPaint.fromValue(paint));
        }
        drawPatch(cubics, colors, texs, mode, paint) {
          this.ref.drawPatch(cubics.map(({
            x,
            y
          }) => [x, y]).flat(), colors, texs ? texs.flatMap((p) => Array.from(JsiSkPoint.fromValue(p))) : texs, mode ? getEnum(this.CanvasKit, "BlendMode", mode) : null, paint ? JsiSkPaint.fromValue(paint) : void 0);
        }
        restoreToCount(saveCount) {
          this.ref.restoreToCount(saveCount);
        }
        getTotalMatrix() {
          return new JsiSkMatrix(this.CanvasKit, Float32Array.of(...this.ref.getTotalMatrix()));
        }
        drawPoints(mode, points, paint) {
          this.ref.drawPoints(getEnum(this.CanvasKit, "PointMode", mode), points.map(({
            x,
            y
          }) => [x, y]).flat(), JsiSkPaint.fromValue(paint));
        }
        drawArc(oval, startAngle, sweepAngle, useCenter, paint) {
          this.ref.drawArc(JsiSkRect.fromValue(this.CanvasKit, oval), startAngle, sweepAngle, useCenter, JsiSkPaint.fromValue(paint));
        }
        drawRRect(rrect, paint) {
          this.ref.drawRRect(JsiSkRRect.fromValue(this.CanvasKit, rrect), JsiSkPaint.fromValue(paint));
        }
        drawDRRect(outer, inner, paint) {
          this.ref.drawDRRect(JsiSkRRect.fromValue(this.CanvasKit, outer), JsiSkRRect.fromValue(this.CanvasKit, inner), JsiSkPaint.fromValue(paint));
        }
        drawOval(oval, paint) {
          this.ref.drawOval(JsiSkRect.fromValue(this.CanvasKit, oval), JsiSkPaint.fromValue(paint));
        }
        drawPath(path, paint) {
          const p = JsiSkPath.pathFromValue(path);
          this.ref.drawPath(p, JsiSkPaint.fromValue(paint));
          p.delete();
        }
        drawText(str, x, y, paint, font) {
          this.ref.drawText(str, x, y, JsiSkPaint.fromValue(paint), JsiSkFont.fromValue(font));
        }
        drawTextBlob(blob, x, y, paint) {
          this.ref.drawTextBlob(JsiSkTextBlob.fromValue(blob), x, y, JsiSkPaint.fromValue(paint));
        }
        drawGlyphs(glyphs, positions, x, y, font, paint) {
          this.ref.drawGlyphs(glyphs, positions.map((p) => [p.x, p.y]).flat(), x, y, JsiSkFont.fromValue(font), JsiSkPaint.fromValue(paint));
        }
        drawSvg(svg, _width, _height) {
          const image = this.CanvasKit.MakeImageFromCanvasImageSource(svg.ref);
          this.ref.drawImage(image, 0, 0);
        }
        save() {
          return this.ref.save();
        }
        saveLayer(paint, bounds, backdrop, flags) {
          return this.ref.saveLayer(paint ? JsiSkPaint.fromValue(paint) : void 0, bounds ? JsiSkRect.fromValue(this.CanvasKit, bounds) : bounds, backdrop ? JsiSkImageFilter.fromValue(backdrop) : backdrop, flags);
        }
        restore() {
          this.ref.restore();
        }
        rotate(rotationInDegrees, rx, ry) {
          this.ref.rotate(rotationInDegrees, rx, ry);
        }
        scale(sx, sy) {
          this.ref.scale(sx, sy);
        }
        skew(sx, sy) {
          this.ref.skew(sx, sy);
        }
        translate(dx, dy) {
          this.ref.translate(dx, dy);
        }
        drawColor(color, blendMode) {
          this.ref.drawColor(color, blendMode ? getEnum(this.CanvasKit, "BlendMode", blendMode) : void 0);
        }
        clear(color) {
          this.ref.clear(color);
        }
        clipPath(path, op, doAntiAlias) {
          const p = JsiSkPath.pathFromValue(path);
          this.ref.clipPath(p, getEnum(this.CanvasKit, "PathOp", op), doAntiAlias);
          p.delete();
        }
        clipRect(rect, op, doAntiAlias) {
          this.ref.clipRect(JsiSkRect.fromValue(this.CanvasKit, rect), getEnum(this.CanvasKit, "PathOp", op), doAntiAlias);
        }
        clipRRect(rrect, op, doAntiAlias) {
          this.ref.clipRRect(JsiSkRRect.fromValue(this.CanvasKit, rrect), getEnum(this.CanvasKit, "PathOp", op), doAntiAlias);
        }
        concat(m) {
          this.ref.concat(Array.isArray(m) ? m : JsiSkMatrix.fromValue(m));
        }
        drawPicture(skp) {
          this.ref.drawPicture(JsiSkPicture.fromValue(skp));
        }
        drawAtlas(atlas, srcs, dsts, paint, blendMode, colors, sampling) {
          const src = srcs.flatMap((s) => Array.from(JsiSkRect.fromValue(this.CanvasKit, s)));
          const dst = dsts.flatMap((s) => Array.from(JsiSkRSXform.fromValue(s)));
          let cls;
          if (colors) {
            cls = new Uint32Array(colors.length);
            for (let i = 0; i < colors.length; i++) {
              const [r, g, b, a] = colors[i];
              cls[i] = this.CanvasKit.ColorAsInt(r * 255, g * 255, b * 255, a * 255);
            }
          }
          let ckSampling = {
            filter: this.CanvasKit.FilterMode.Linear,
            mipmap: this.CanvasKit.MipmapMode.None
          };
          if (sampling && isCubicSampling(sampling)) {
            ckSampling = sampling;
          } else if (sampling) {
            ckSampling = {
              filter: getEnum(this.CanvasKit, "FilterMode", sampling.filter),
              mipmap: sampling.mipmap ? getEnum(this.CanvasKit, "MipmapMode", sampling.mipmap) : this.CanvasKit.MipmapMode.None
            };
          }
          this.ref.drawAtlas(JsiSkImage.fromValue(atlas), src, dst, JsiSkPaint.fromValue(paint), blendMode ? getEnum(this.CanvasKit, "BlendMode", blendMode) : this.CanvasKit.BlendMode.DstOver, cls, ckSampling);
        }
        readPixels(srcX, srcY, imageInfo) {
          const pxInfo = {
            width: imageInfo.width,
            height: imageInfo.height,
            colorSpace: this.CanvasKit.ColorSpace.SRGB,
            alphaType: getEnum(this.CanvasKit, "AlphaType", imageInfo.alphaType),
            colorType: getEnum(this.CanvasKit, "ColorType", imageInfo.colorType)
          };
          return this.ref.readPixels(srcX, srcY, pxInfo);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkSurface.js
  var JsiSkSurface;
  var init_JsiSkSurface = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkSurface.js"() {
      init_Host();
      init_JsiSkCanvas();
      init_JsiSkImage();
      init_JsiSkRect();
      JsiSkSurface = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "Surface");
        }
        [Symbol.dispose]() {
          this.ref.dispose();
        }
        flush() {
          this.ref.flush();
        }
        width() {
          return this.ref.width();
        }
        height() {
          return this.ref.height();
        }
        getCanvas() {
          return new JsiSkCanvas(this.CanvasKit, this.ref.getCanvas());
        }
        makeImageSnapshot(bounds, outputImage) {
          const image = this.ref.makeImageSnapshot(bounds ? Array.from(JsiSkRect.fromValue(this.CanvasKit, bounds)) : void 0);
          if (outputImage) {
            outputImage.ref = image;
          }
          return new JsiSkImage(this.CanvasKit, image);
        }
        getNativeTextureUnstable() {
          console.warn("getBackendTexture is not implemented on Web");
          return null;
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkSurfaceFactory.js
  var JsiSkSurfaceFactory;
  var init_JsiSkSurfaceFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkSurfaceFactory.js"() {
      init_Host();
      init_JsiSkSurface();
      JsiSkSurfaceFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        Make(width, height) {
          return new JsiSkSurface(this.CanvasKit, this.CanvasKit.MakeSurface(width, height));
        }
        MakeOffscreen(width, height) {
          const OC = globalThis.OffscreenCanvas;
          let surface;
          if (OC === void 0) {
            return this.Make(width, height);
          } else {
            const offscreen = new OC(width, height);
            const webglContext = this.CanvasKit.GetWebGLContext(offscreen);
            const grContext = this.CanvasKit.MakeWebGLContext(webglContext);
            if (!grContext) {
              throw new Error("Could not make a graphics context");
            }
            surface = this.CanvasKit.MakeRenderTarget(grContext, width, height);
          }
          if (!surface) {
            return null;
          }
          return new JsiSkSurface(this.CanvasKit, surface);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkContourMeasure.js
  var JsiSkContourMeasure;
  var init_JsiSkContourMeasure = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkContourMeasure.js"() {
      init_Host();
      init_JsiSkPath();
      init_JsiSkPoint();
      JsiSkContourMeasure = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "ContourMeasure");
        }
        getPosTan(distance) {
          const posTan = this.ref.getPosTan(distance);
          return [new JsiSkPoint(this.CanvasKit, posTan.slice(0, 2)), new JsiSkPoint(this.CanvasKit, posTan.slice(2))];
        }
        getSegment(startD, stopD, startWithMoveTo) {
          const segment = this.ref.getSegment(startD, stopD, startWithMoveTo);
          const builder = new this.CanvasKit.PathBuilder(segment);
          segment.delete();
          return new JsiSkPath(this.CanvasKit, builder);
        }
        isClosed() {
          return this.ref.isClosed();
        }
        length() {
          return this.ref.length();
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkContourMeasureIter.js
  var JsiSkContourMeasureIter;
  var init_JsiSkContourMeasureIter = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkContourMeasureIter.js"() {
      init_Host();
      init_JsiSkContourMeasure();
      JsiSkContourMeasureIter = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "ContourMeasureIter");
        }
        next() {
          const result = this.ref.next();
          if (result === null) {
            return null;
          }
          return new JsiSkContourMeasure(this.CanvasKit, result);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPictureRecorder.js
  var JsiSkPictureRecorder;
  var init_JsiSkPictureRecorder = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPictureRecorder.js"() {
      init_Host();
      init_JsiSkCanvas();
      init_JsiSkPicture();
      init_JsiSkRect();
      JsiSkPictureRecorder = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "PictureRecorder");
        }
        beginRecording(bounds) {
          return new JsiSkCanvas(this.CanvasKit, this.ref.beginRecording(bounds ? JsiSkRect.fromValue(this.CanvasKit, bounds) : Float32Array.of(0, 0, 2e6, 2e6)));
        }
        finishRecordingAsPicture() {
          return new JsiSkPicture(this.CanvasKit, this.ref.finishRecordingAsPicture());
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPictureFactory.js
  var JsiSkPictureFactory;
  var init_JsiSkPictureFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPictureFactory.js"() {
      init_Host();
      init_JsiSkPicture();
      JsiSkPictureFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        MakePicture(bytes) {
          const pic = this.CanvasKit.MakePicture(bytes);
          if (pic === null) {
            return null;
          }
          return new JsiSkPicture(this.CanvasKit, pic);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPathFactory.js
  var pinT, JsiSkPathFactory;
  var init_JsiSkPathFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPathFactory.js"() {
      init_Host();
      init_JsiSkPath();
      init_JsiSkPoint();
      init_JsiSkRect();
      init_JsiSkRRect();
      pinT = (t) => Math.min(Math.max(t, 0), 1);
      JsiSkPathFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        Make() {
          return new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder());
        }
        MakeFromSVGString(str) {
          const path = this.CanvasKit.Path.MakeFromSVGString(str);
          if (path === null) {
            return null;
          }
          const result = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
          path.delete();
          return result;
        }
        MakeFromOp(one, two, op) {
          const p1 = JsiSkPath.fromValue(one).snapshot();
          const p2 = JsiSkPath.fromValue(two).snapshot();
          const path = this.CanvasKit.Path.MakeFromOp(p1, p2, getEnum(this.CanvasKit, "PathOp", op));
          p1.delete();
          p2.delete();
          if (path === null) {
            return null;
          }
          const result = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
          path.delete();
          return result;
        }
        MakeFromCmds(cmds) {
          const path = this.CanvasKit.Path.MakeFromCmds(cmds.flat());
          if (path === null) {
            return null;
          }
          const result = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
          path.delete();
          return result;
        }
        MakeFromText(_text, _x, _y, _font) {
          return throwNotImplementedOnRNWeb();
        }
        // Static shape factories
        Rect(rect, isCCW) {
          const builder = new this.CanvasKit.PathBuilder();
          builder.addRect(JsiSkRect.fromValue(this.CanvasKit, rect), isCCW);
          return new JsiSkPath(this.CanvasKit, builder);
        }
        Oval(rect, isCCW, startIndex) {
          const builder = new this.CanvasKit.PathBuilder();
          builder.addOval(JsiSkRect.fromValue(this.CanvasKit, rect), isCCW, startIndex);
          return new JsiSkPath(this.CanvasKit, builder);
        }
        Circle(x, y, r) {
          const builder = new this.CanvasKit.PathBuilder();
          builder.addCircle(x, y, r);
          return new JsiSkPath(this.CanvasKit, builder);
        }
        RRect(rrect, isCCW) {
          const builder = new this.CanvasKit.PathBuilder();
          builder.addRRect(JsiSkRRect.fromValue(this.CanvasKit, rrect), isCCW);
          return new JsiSkPath(this.CanvasKit, builder);
        }
        Line(p1, p2) {
          const builder = new this.CanvasKit.PathBuilder();
          const pt1 = JsiSkPoint.fromValue(p1);
          const pt2 = JsiSkPoint.fromValue(p2);
          builder.moveTo(pt1[0], pt1[1]);
          builder.lineTo(pt2[0], pt2[1]);
          return new JsiSkPath(this.CanvasKit, builder);
        }
        Polygon(points, close) {
          const builder = new this.CanvasKit.PathBuilder();
          builder.addPolygon(points.map((p) => Array.from(JsiSkPoint.fromValue(p))).flat(), close);
          return new JsiSkPath(this.CanvasKit, builder);
        }
        // Static path operations
        Stroke(srcPath, opts) {
          const path = JsiSkPath.fromValue(srcPath).snapshot();
          const result = path.makeStroked(opts === void 0 ? void 0 : {
            width: opts.width,
            // eslint-disable-next-line camelcase
            miter_limit: opts.miter_limit,
            precision: opts.precision,
            join: optEnum(this.CanvasKit, "StrokeJoin", opts.join),
            cap: optEnum(this.CanvasKit, "StrokeCap", opts.cap)
          });
          path.delete();
          if (result === null) {
            return null;
          }
          const r = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(result));
          result.delete();
          return r;
        }
        Trim(srcPath, start, end, isComplement) {
          const startT = pinT(start);
          const stopT = pinT(end);
          const path = JsiSkPath.fromValue(srcPath).snapshot();
          if (startT <= 0 && stopT >= 1 && !isComplement) {
            const r2 = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
            path.delete();
            return r2;
          }
          const result = path.makeTrimmed(startT, stopT, isComplement);
          path.delete();
          if (result === null) {
            return null;
          }
          const r = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(result));
          result.delete();
          return r;
        }
        Simplify(srcPath) {
          const path = JsiSkPath.fromValue(srcPath).snapshot();
          const result = path.makeSimplified();
          path.delete();
          if (result === null) {
            return null;
          }
          const r = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(result));
          result.delete();
          return r;
        }
        Dash(srcPath, on, off, phase) {
          const path = JsiSkPath.fromValue(srcPath).snapshot();
          const result = path.makeDashed(on, off, phase);
          path.delete();
          if (result === null) {
            return null;
          }
          const r = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(result));
          result.delete();
          return r;
        }
        AsWinding(srcPath) {
          const path = JsiSkPath.fromValue(srcPath).snapshot();
          const result = path.makeAsWinding();
          path.delete();
          if (result === null) {
            return null;
          }
          const r = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(result));
          result.delete();
          return r;
        }
        Interpolate(start, end, weight) {
          const p1 = JsiSkPath.fromValue(start).snapshot();
          const p2 = JsiSkPath.fromValue(end).snapshot();
          const path = this.CanvasKit.Path.MakeFromPathInterpolation(p1, p2, weight);
          p1.delete();
          p2.delete();
          if (path === null) {
            return null;
          }
          const r = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
          path.delete();
          return r;
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPathBuilder.js
  var JsiSkPathBuilder;
  var init_JsiSkPathBuilder = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPathBuilder.js"() {
      init_Host();
      init_JsiSkPath();
      init_JsiSkMatrix();
      init_JsiSkPoint();
      init_JsiSkRect();
      init_JsiSkRRect();
      JsiSkPathBuilder = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "PathBuilder");
        }
        // Movement methods
        moveTo(x, y) {
          this.ref.moveTo(x, y);
          return this;
        }
        rMoveTo(x, y) {
          this.ref.rMoveTo(x, y);
          return this;
        }
        lineTo(x, y) {
          this.ref.lineTo(x, y);
          return this;
        }
        rLineTo(x, y) {
          this.ref.rLineTo(x, y);
          return this;
        }
        // Curve methods
        quadTo(x1, y1, x2, y2) {
          this.ref.quadTo(x1, y1, x2, y2);
          return this;
        }
        rQuadTo(x1, y1, x2, y2) {
          this.ref.rQuadTo(x1, y1, x2, y2);
          return this;
        }
        conicTo(x1, y1, x2, y2, w) {
          this.ref.conicTo(x1, y1, x2, y2, w);
          return this;
        }
        rConicTo(x1, y1, x2, y2, w) {
          this.ref.rConicTo(x1, y1, x2, y2, w);
          return this;
        }
        cubicTo(x1, y1, x2, y2, x3, y3) {
          this.ref.cubicTo(x1, y1, x2, y2, x3, y3);
          return this;
        }
        rCubicTo(x1, y1, x2, y2, x3, y3) {
          this.ref.rCubicTo(x1, y1, x2, y2, x3, y3);
          return this;
        }
        close() {
          this.ref.close();
          return this;
        }
        // Arc methods
        arcToOval(oval, startAngleInDegrees, sweepAngleInDegrees, forceMoveTo) {
          this.ref.arcToOval(JsiSkRect.fromValue(this.CanvasKit, oval), startAngleInDegrees, sweepAngleInDegrees, forceMoveTo);
          return this;
        }
        arcToRotated(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, x, y) {
          this.ref.arcToRotated(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, x, y);
          return this;
        }
        rArcTo(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, dx, dy) {
          this.ref.rArcTo(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, dx, dy);
          return this;
        }
        arcToTangent(x1, y1, x2, y2, radius) {
          this.ref.arcToTangent(x1, y1, x2, y2, radius);
          return this;
        }
        // Shape methods
        addRect(rect, isCCW) {
          this.ref.addRect(JsiSkRect.fromValue(this.CanvasKit, rect), isCCW);
          return this;
        }
        addOval(oval, isCCW, startIndex) {
          this.ref.addOval(JsiSkRect.fromValue(this.CanvasKit, oval), isCCW, startIndex);
          return this;
        }
        addArc(oval, startAngleInDegrees, sweepAngleInDegrees) {
          this.ref.addArc(JsiSkRect.fromValue(this.CanvasKit, oval), startAngleInDegrees, sweepAngleInDegrees);
          return this;
        }
        addRRect(rrect, isCCW) {
          this.ref.addRRect(JsiSkRRect.fromValue(this.CanvasKit, rrect), isCCW);
          return this;
        }
        addCircle(x, y, r, _isCCW) {
          this.ref.addCircle(x, y, r);
          return this;
        }
        addPoly(points, close) {
          this.ref.addPolygon(points.map((p) => Array.from(JsiSkPoint.fromValue(p))).flat(), close);
          return this;
        }
        addPath(src, matrix, extend = false) {
          const srcPath = JsiSkPath.pathFromValue(src);
          const args = [srcPath, ...matrix ? JsiSkMatrix.fromValue(matrix) : [], extend];
          this.ref.addPath(...args);
          srcPath.delete();
          return this;
        }
        // Configuration methods
        setFillType(fill) {
          this.ref.setFillType(getEnum(this.CanvasKit, "FillType", fill));
          return this;
        }
        setIsVolatile(_isVolatile) {
          return this;
        }
        reset() {
          const newBuilder = new this.CanvasKit.PathBuilder();
          if (this.ref !== null && typeof this.ref === "object" && "delete" in this.ref && typeof this.ref.delete === "function") {
            this.ref.delete();
          }
          this.ref = newBuilder;
          return this;
        }
        offset(dx, dy) {
          this.ref.offset(dx, dy);
          return this;
        }
        transform(m) {
          const matrix = toMatrix3x3(m);
          this.ref.transform(matrix);
          return this;
        }
        // Query methods
        computeBounds() {
          return new JsiSkRect(this.CanvasKit, this.ref.getBounds());
        }
        isEmpty() {
          return this.ref.isEmpty();
        }
        getLastPt() {
          const count = this.ref.countPoints();
          if (count === 0) {
            return {
              x: 0,
              y: 0
            };
          }
          const path = this.ref.snapshot();
          const pt = path.getPoint(count - 1);
          path.delete();
          return {
            x: pt[0],
            y: pt[1]
          };
        }
        countPoints() {
          return this.ref.countPoints();
        }
        // Build methods
        build() {
          const path = this.ref.snapshot();
          const builder = new this.CanvasKit.PathBuilder(path);
          path.delete();
          return new JsiSkPath(this.CanvasKit, builder);
        }
        detach() {
          const path = this.ref.detach();
          const builder = new this.CanvasKit.PathBuilder(path);
          path.delete();
          return new JsiSkPath(this.CanvasKit, builder);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPathBuilderFactory.js
  var JsiSkPathBuilderFactory;
  var init_JsiSkPathBuilderFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPathBuilderFactory.js"() {
      init_Host();
      init_JsiSkPath();
      init_JsiSkPathBuilder();
      JsiSkPathBuilderFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        Make() {
          return new JsiSkPathBuilder(this.CanvasKit, new this.CanvasKit.PathBuilder());
        }
        MakeFromPath(path) {
          const srcBuilder = JsiSkPath.fromValue(path);
          const srcPath = srcBuilder.snapshot();
          const builder = new this.CanvasKit.PathBuilder(srcPath);
          srcPath.delete();
          return new JsiSkPathBuilder(this.CanvasKit, builder);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkColorFilterFactory.js
  var JsiSkColorFilterFactory;
  var init_JsiSkColorFilterFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkColorFilterFactory.js"() {
      init_Host();
      init_JsiSkColorFilter();
      JsiSkColorFilterFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        MakeMatrix(cMatrix) {
          return new JsiSkColorFilter(this.CanvasKit, this.CanvasKit.ColorFilter.MakeMatrix(cMatrix));
        }
        MakeBlend(color, mode) {
          return new JsiSkColorFilter(this.CanvasKit, this.CanvasKit.ColorFilter.MakeBlend(color, getEnum(this.CanvasKit, "BlendMode", mode)));
        }
        MakeCompose(outer, inner) {
          return new JsiSkColorFilter(this.CanvasKit, this.CanvasKit.ColorFilter.MakeCompose(JsiSkColorFilter.fromValue(outer), JsiSkColorFilter.fromValue(inner)));
        }
        MakeLerp(t, dst, src) {
          return new JsiSkColorFilter(this.CanvasKit, this.CanvasKit.ColorFilter.MakeLerp(t, JsiSkColorFilter.fromValue(dst), JsiSkColorFilter.fromValue(src)));
        }
        MakeLinearToSRGBGamma() {
          return new JsiSkColorFilter(this.CanvasKit, this.CanvasKit.ColorFilter.MakeLinearToSRGBGamma());
        }
        MakeSRGBToLinearGamma() {
          return new JsiSkColorFilter(this.CanvasKit, this.CanvasKit.ColorFilter.MakeSRGBToLinearGamma());
        }
        MakeLumaColorFilter() {
          return new JsiSkColorFilter(this.CanvasKit, this.CanvasKit.ColorFilter.MakeLuma());
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkTypefaceFactory.js
  var JsiSkTypefaceFactory;
  var init_JsiSkTypefaceFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkTypefaceFactory.js"() {
      init_Host();
      init_JsiSkTypeface();
      JsiSkTypefaceFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        MakeFreeTypeFaceFromData(data) {
          const tf = this.CanvasKit.Typeface.MakeFreeTypeFaceFromData(JsiSkTypeface.fromValue(data));
          if (tf === null) {
            return null;
          }
          return new JsiSkTypeface(this.CanvasKit, tf);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkMaskFilterFactory.js
  var JsiSkMaskFilterFactory;
  var init_JsiSkMaskFilterFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkMaskFilterFactory.js"() {
      init_Host();
      init_JsiSkMaskFilter();
      JsiSkMaskFilterFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        MakeBlur(style2, sigma, respectCTM) {
          return new JsiSkMaskFilter(this.CanvasKit, this.CanvasKit.MaskFilter.MakeBlur(getEnum(this.CanvasKit, "BlurStyle", style2), sigma, respectCTM));
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkRuntimeEffect.js
  var JsiSkRuntimeEffect;
  var init_JsiSkRuntimeEffect = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkRuntimeEffect.js"() {
      init_Host();
      init_JsiSkMatrix();
      init_JsiSkShader();
      JsiSkRuntimeEffect = class extends HostObject {
        constructor(CanvasKit, ref, sksl) {
          super(CanvasKit, ref, "RuntimeEffect");
          this.sksl = sksl;
        }
        source() {
          return this.sksl;
        }
        makeShader(uniforms, localMatrix) {
          return new JsiSkShader(this.CanvasKit, this.ref.makeShader(uniforms, localMatrix !== void 0 ? JsiSkMatrix.fromValue(localMatrix) : localMatrix));
        }
        makeShaderWithChildren(uniforms, children, localMatrix) {
          return new JsiSkShader(this.CanvasKit, this.ref.makeShaderWithChildren(uniforms, children === null || children === void 0 ? void 0 : children.map((child) => JsiSkShader.fromValue(child)), localMatrix !== void 0 ? JsiSkMatrix.fromValue(localMatrix) : localMatrix));
        }
        getUniform(index) {
          return this.ref.getUniform(index);
        }
        getUniformCount() {
          return this.ref.getUniformCount();
        }
        getUniformFloatCount() {
          return this.ref.getUniformFloatCount();
        }
        getUniformName(index) {
          return this.ref.getUniformName(index);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkRuntimeEffectFactory.js
  var JsiSkRuntimeEffectFactory;
  var init_JsiSkRuntimeEffectFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkRuntimeEffectFactory.js"() {
      init_Host();
      init_JsiSkRuntimeEffect();
      JsiSkRuntimeEffectFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        Make(sksl) {
          const re = this.CanvasKit.RuntimeEffect.Make(sksl);
          if (re === null) {
            return null;
          }
          return new JsiSkRuntimeEffect(this.CanvasKit, re, sksl);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkImageFilterFactory.js
  var JsiSkImageFilterFactory;
  var init_JsiSkImageFilterFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkImageFilterFactory.js"() {
      init_Host();
      init_JsiSkImageFilter();
      init_JsiSkColorFilter();
      JsiSkImageFilterFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        MakeRuntimeShaderWithChildren(_builder, _sampleRadius, _childShaderNames, _inputs) {
          throw throwNotImplementedOnRNWeb();
        }
        MakeArithmetic(_k1, _k2, _k3, _k4, _enforcePMColor, _background, _foreground, _cropRect) {
          throw throwNotImplementedOnRNWeb();
        }
        MakeCrop(_rect, _tileMode, _input) {
          throw throwNotImplementedOnRNWeb();
        }
        MakeEmpty() {
          throw throwNotImplementedOnRNWeb();
        }
        MakeImage(_image, _srcRect, _dstRect, _filterMode, _mipmap) {
          throw throwNotImplementedOnRNWeb();
        }
        MakeMagnifier(_lensBounds, _zoomAmount, _inset, _filterMode, _mipmap, _input, _cropRect) {
          throw throwNotImplementedOnRNWeb();
        }
        MakeMatrixConvolution(_kernelSizeX, _kernelSizeY, _kernel, _gain, _bias, _kernelOffsetX, _kernelOffsetY, _tileMode, _convolveAlpha, _input, _cropRect) {
          throw throwNotImplementedOnRNWeb();
        }
        MakeMatrixTransform(_matrix, _filterMode, _mipmap, _input) {
          throw throwNotImplementedOnRNWeb();
        }
        MakeMerge(_filters, _cropRect) {
          throw throwNotImplementedOnRNWeb();
        }
        MakePicture(_picture, _targetRect) {
          throw throwNotImplementedOnRNWeb();
        }
        MakeTile(_src, _dst, _input) {
          throw throwNotImplementedOnRNWeb();
        }
        MakeDistantLitDiffuse(_direction, _lightColor, _surfaceScale, _kd, _input, _cropRect) {
          throw throwNotImplementedOnRNWeb();
        }
        MakePointLitDiffuse(_location, _lightColor, _surfaceScale, _kd, _input, _cropRect) {
          throw throwNotImplementedOnRNWeb();
        }
        MakeSpotLitDiffuse(_location, _target, _falloffExponent, _cutoffAngle, _lightColor, _surfaceScale, _kd, _input, _cropRect) {
          throw throwNotImplementedOnRNWeb();
        }
        MakeDistantLitSpecular(_direction, _lightColor, _surfaceScale, _ks, _shininess, _input, _cropRect) {
          throw throwNotImplementedOnRNWeb();
        }
        MakePointLitSpecular(_location, _lightColor, _surfaceScale, _ks, _shininess, _input, _cropRect) {
          throw throwNotImplementedOnRNWeb();
        }
        MakeSpotLitSpecular(_location, _target, _falloffExponent, _cutoffAngle, _lightColor, _surfaceScale, _ks, _shininess, _input, _cropRect) {
          throw throwNotImplementedOnRNWeb();
        }
        MakeOffset(dx, dy, input, cropRect) {
          const inputFilter = input === null || input === void 0 ? null : JsiSkImageFilter.fromValue(input);
          if (cropRect) {
            console.warn("cropRect is not supported on React Native Web for MakeOffset");
          }
          const filter = this.CanvasKit.ImageFilter.MakeOffset(dx, dy, inputFilter);
          return new JsiSkImageFilter(this.CanvasKit, filter);
        }
        MakeDisplacementMap(channelX, channelY, scale, in1, input, cropRect) {
          const inputFilter = input === null || input === void 0 ? null : JsiSkImageFilter.fromValue(input);
          if (cropRect) {
            console.warn("cropRect is not supported on React Native Web for MakeDisplacementMap");
          }
          const filter = this.CanvasKit.ImageFilter.MakeDisplacementMap(getEnum(this.CanvasKit, "ColorChannel", channelX), getEnum(this.CanvasKit, "ColorChannel", channelY), scale, JsiSkImageFilter.fromValue(in1), inputFilter);
          return new JsiSkImageFilter(this.CanvasKit, filter);
        }
        MakeShader(shader, dither, cropRect) {
          if (dither !== void 0) {
            console.warn("dither parameter is not supported on React Native Web for MakeShader");
          }
          if (cropRect) {
            console.warn("cropRect is not supported on React Native Web for MakeShader");
          }
          const filter = this.CanvasKit.ImageFilter.MakeShader(JsiSkImageFilter.fromValue(shader));
          return new JsiSkImageFilter(this.CanvasKit, filter);
        }
        MakeBlur(sigmaX, sigmaY, mode, input, cropRect) {
          if (cropRect) {
            console.warn("cropRect is not supported on React Native Web for MakeBlur");
          }
          return new JsiSkImageFilter(this.CanvasKit, this.CanvasKit.ImageFilter.MakeBlur(sigmaX, sigmaY, getEnum(this.CanvasKit, "TileMode", mode), input === null || input === void 0 ? null : JsiSkImageFilter.fromValue(input)));
        }
        MakeColorFilter(colorFilter, input, cropRect) {
          if (cropRect) {
            console.warn("cropRect is not supported on React Native Web for MakeColorFilter");
          }
          return new JsiSkImageFilter(this.CanvasKit, this.CanvasKit.ImageFilter.MakeColorFilter(JsiSkColorFilter.fromValue(colorFilter), input === null || input === void 0 ? null : JsiSkImageFilter.fromValue(input)));
        }
        MakeCompose(outer, inner) {
          return new JsiSkImageFilter(this.CanvasKit, this.CanvasKit.ImageFilter.MakeCompose(outer === null ? null : JsiSkImageFilter.fromValue(outer), inner === null ? null : JsiSkImageFilter.fromValue(inner)));
        }
        MakeDropShadow(dx, dy, sigmaX, sigmaY, color, input, cropRect) {
          const inputFilter = input === null || input === void 0 ? null : JsiSkImageFilter.fromValue(input);
          if (cropRect) {
            console.warn("cropRect is not supported on React Native Web for MakeDropShadow");
          }
          const filter = this.CanvasKit.ImageFilter.MakeDropShadow(dx, dy, sigmaX, sigmaY, color, inputFilter);
          return new JsiSkImageFilter(this.CanvasKit, filter);
        }
        MakeDropShadowOnly(dx, dy, sigmaX, sigmaY, color, input, cropRect) {
          const inputFilter = input === null || input === void 0 ? null : JsiSkImageFilter.fromValue(input);
          if (cropRect) {
            console.warn("cropRect is not supported on React Native Web for MakeDropShadowOnly");
          }
          const filter = this.CanvasKit.ImageFilter.MakeDropShadowOnly(dx, dy, sigmaX, sigmaY, color, inputFilter);
          return new JsiSkImageFilter(this.CanvasKit, filter);
        }
        MakeErode(rx, ry, input, cropRect) {
          const inputFilter = input === null || input === void 0 ? null : JsiSkImageFilter.fromValue(input);
          if (cropRect) {
            console.warn("cropRect is not supported on React Native Web for MakeErode");
          }
          const filter = this.CanvasKit.ImageFilter.MakeErode(rx, ry, inputFilter);
          return new JsiSkImageFilter(this.CanvasKit, filter);
        }
        MakeDilate(rx, ry, input, cropRect) {
          const inputFilter = input === null || input === void 0 ? null : JsiSkImageFilter.fromValue(input);
          if (cropRect) {
            console.warn("cropRect is not supported on React Native Web for MakeDilate");
          }
          const filter = this.CanvasKit.ImageFilter.MakeDilate(rx, ry, inputFilter);
          return new JsiSkImageFilter(this.CanvasKit, filter);
        }
        MakeBlend(mode, background, foreground, cropRect) {
          const inputFilter = foreground === null || foreground === void 0 ? null : JsiSkImageFilter.fromValue(foreground);
          if (cropRect) {
            console.warn("cropRect is not supported on React Native Web for MakeBlend");
          }
          const filter = this.CanvasKit.ImageFilter.MakeBlend(getEnum(this.CanvasKit, "BlendMode", mode), JsiSkImageFilter.fromValue(background), inputFilter);
          return new JsiSkImageFilter(this.CanvasKit, filter);
        }
        MakeRuntimeShader(_builder, _childShaderName, _input) {
          return throwNotImplementedOnRNWeb();
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkShaderFactory.js
  var JsiSkShaderFactory;
  var init_JsiSkShaderFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkShaderFactory.js"() {
      init_Host();
      init_JsiSkMatrix();
      init_JsiSkPoint();
      init_JsiSkShader();
      JsiSkShaderFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        MakeLinearGradient(start, end, colors, pos, mode, localMatrix, flags) {
          return new JsiSkShader(this.CanvasKit, this.CanvasKit.Shader.MakeLinearGradient(JsiSkPoint.fromValue(start), JsiSkPoint.fromValue(end), colors, pos, getEnum(this.CanvasKit, "TileMode", mode), localMatrix === void 0 ? void 0 : JsiSkMatrix.fromValue(localMatrix), flags));
        }
        MakeRadialGradient(center, radius, colors, pos, mode, localMatrix, flags) {
          return new JsiSkShader(this.CanvasKit, this.CanvasKit.Shader.MakeRadialGradient(JsiSkPoint.fromValue(center), radius, colors, pos, getEnum(this.CanvasKit, "TileMode", mode), localMatrix === void 0 ? void 0 : JsiSkMatrix.fromValue(localMatrix), flags));
        }
        MakeTwoPointConicalGradient(start, startRadius, end, endRadius, colors, pos, mode, localMatrix, flags) {
          return new JsiSkShader(this.CanvasKit, this.CanvasKit.Shader.MakeTwoPointConicalGradient(JsiSkPoint.fromValue(start), startRadius, JsiSkPoint.fromValue(end), endRadius, colors, pos, getEnum(this.CanvasKit, "TileMode", mode), localMatrix === void 0 ? void 0 : JsiSkMatrix.fromValue(localMatrix), flags));
        }
        MakeSweepGradient(cx, cy, colors, pos, mode, localMatrix, flags, startAngleInDegrees, endAngleInDegrees) {
          return new JsiSkShader(this.CanvasKit, this.CanvasKit.Shader.MakeSweepGradient(cx, cy, colors, pos, getEnum(this.CanvasKit, "TileMode", mode), localMatrix === void 0 || localMatrix === null ? void 0 : JsiSkMatrix.fromValue(localMatrix), flags, startAngleInDegrees, endAngleInDegrees));
        }
        MakeTurbulence(baseFreqX, baseFreqY, octaves, seed, tileW, tileH) {
          return new JsiSkShader(this.CanvasKit, this.CanvasKit.Shader.MakeTurbulence(baseFreqX, baseFreqY, octaves, seed, tileW, tileH));
        }
        MakeFractalNoise(baseFreqX, baseFreqY, octaves, seed, tileW, tileH) {
          return new JsiSkShader(this.CanvasKit, this.CanvasKit.Shader.MakeFractalNoise(baseFreqX, baseFreqY, octaves, seed, tileW, tileH));
        }
        MakeBlend(mode, one, two) {
          return new JsiSkShader(this.CanvasKit, this.CanvasKit.Shader.MakeBlend(getEnum(this.CanvasKit, "BlendMode", mode), JsiSkShader.fromValue(one), JsiSkShader.fromValue(two)));
        }
        MakeColor(color) {
          return new JsiSkShader(this.CanvasKit, this.CanvasKit.Shader.MakeColor(color, this.CanvasKit.ColorSpace.SRGB));
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPathEffectFactory.js
  var JsiSkPathEffectFactory;
  var init_JsiSkPathEffectFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkPathEffectFactory.js"() {
      init_Host();
      init_JsiSkMatrix();
      init_JsiSkPath();
      init_JsiSkPathEffect();
      JsiSkPathEffectFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        MakeCorner(radius) {
          const pe = this.CanvasKit.PathEffect.MakeCorner(radius);
          if (pe === null) {
            return null;
          }
          return new JsiSkPathEffect(this.CanvasKit, pe);
        }
        MakeDash(intervals, phase) {
          const pe = this.CanvasKit.PathEffect.MakeDash(intervals, phase);
          return new JsiSkPathEffect(this.CanvasKit, pe);
        }
        MakeDiscrete(segLength, dev, seedAssist) {
          const pe = this.CanvasKit.PathEffect.MakeDiscrete(segLength, dev, seedAssist);
          return new JsiSkPathEffect(this.CanvasKit, pe);
        }
        MakeCompose(_outer, _inner) {
          return throwNotImplementedOnRNWeb();
        }
        MakeSum(_outer, _inner) {
          return throwNotImplementedOnRNWeb();
        }
        MakeLine2D(width, matrix) {
          const pe = this.CanvasKit.PathEffect.MakeLine2D(width, JsiSkMatrix.fromValue(matrix));
          if (pe === null) {
            return null;
          }
          return new JsiSkPathEffect(this.CanvasKit, pe);
        }
        MakePath1D(path, advance, phase, style2) {
          const p = JsiSkPath.pathFromValue(path);
          const pe = this.CanvasKit.PathEffect.MakePath1D(p, advance, phase, getEnum(this.CanvasKit, "Path1DEffect", style2));
          p.delete();
          if (pe === null) {
            return null;
          }
          return new JsiSkPathEffect(this.CanvasKit, pe);
        }
        MakePath2D(matrix, path) {
          const p = JsiSkPath.pathFromValue(path);
          const pe = this.CanvasKit.PathEffect.MakePath2D(JsiSkMatrix.fromValue(matrix), p);
          p.delete();
          if (pe === null) {
            return null;
          }
          return new JsiSkPathEffect(this.CanvasKit, pe);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkData.js
  var JsiSkData;
  var init_JsiSkData = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkData.js"() {
      init_Host();
      JsiSkData = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "Data");
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkDataFactory.js
  var JsiSkDataFactory;
  var init_JsiSkDataFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkDataFactory.js"() {
      init_Host();
      init_JsiSkData();
      JsiSkDataFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        fromURI(uri) {
          return fetch(uri).then((response) => response.arrayBuffer()).then((data) => new JsiSkData(this.CanvasKit, data));
        }
        /**
         * Creates a new Data object from a byte array.
         * @param bytes An array of bytes representing the data
         */
        fromBytes(bytes) {
          return new JsiSkData(this.CanvasKit, bytes);
        }
        /**
         * Creates a new Data object from a base64 encoded string.
         * @param base64 A Base64 encoded string representing the data
         */
        fromBase64(base64) {
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          return this.fromBytes(bytes);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkImageFactory.js
  var JsiSkImageFactory;
  var init_JsiSkImageFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkImageFactory.js"() {
      init_types2();
      init_Host();
      init_JsiSkImage();
      init_JsiSkData();
      JsiSkImageFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        MakeNull() {
          return new JsiSkImage(this.CanvasKit, null);
        }
        MakeImageFromViewTag(viewTag) {
          const view = viewTag;
          console.log(view);
          return Promise.resolve(null);
        }
        MakeImageFromNativeBuffer(buffer, surface, image) {
          if (!isNativeBufferWeb(buffer)) {
            throw new Error("Invalid NativeBuffer");
          }
          if (!surface) {
            let img;
            if (buffer instanceof HTMLImageElement || buffer instanceof HTMLVideoElement || buffer instanceof ImageBitmap) {
              img = this.CanvasKit.MakeLazyImageFromTextureSource(buffer);
            } else if (buffer instanceof CanvasKitWebGLBuffer) {
              img = buffer.toImage();
            } else {
              img = this.CanvasKit.MakeImageFromCanvasImageSource(buffer);
            }
            return new JsiSkImage(this.CanvasKit, img);
          } else if (!image) {
            const img = surface.makeImageFromTextureSource(buffer);
            return new JsiSkImage(this.CanvasKit, img);
          } else {
            const img = surface.updateTextureFromSource(image, buffer);
            return new JsiSkImage(this.CanvasKit, img);
          }
        }
        MakeImageFromEncoded(encoded) {
          const image = this.CanvasKit.MakeImageFromEncoded(JsiSkData.fromValue(encoded));
          if (image === null) {
            return null;
          }
          return new JsiSkImage(this.CanvasKit, image);
        }
        MakeImageFromNativeTextureUnstable() {
          return throwNotImplementedOnRNWeb();
        }
        MakeImage(info, data, bytesPerRow) {
          const image = this.CanvasKit.MakeImage({
            alphaType: getEnum(this.CanvasKit, "AlphaType", info.alphaType),
            colorSpace: this.CanvasKit.ColorSpace.SRGB,
            colorType: getEnum(this.CanvasKit, "ColorType", info.colorType),
            height: info.height,
            width: info.width
          }, JsiSkData.fromValue(data), bytesPerRow);
          if (image === null) {
            return null;
          }
          return new JsiSkImage(this.CanvasKit, image);
        }
        MakeImageFromTexture(_texture) {
          return throwNotImplementedOnRNWeb();
        }
        MakeTextureFromImage(_image) {
          return throwNotImplementedOnRNWeb();
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkSVG.js
  var JsiSkSVG;
  var init_JsiSkSVG = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkSVG.js"() {
      init_Host();
      JsiSkSVG = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "SVG");
        }
        width() {
          return this.ref.width;
        }
        height() {
          return this.ref.height;
        }
        [Symbol.dispose]() {
          if (this.ref.parentNode) {
            this.ref.parentNode.removeChild(this.ref);
          }
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkSVGFactory.js
  var JsiSkSVGFactory;
  var init_JsiSkSVGFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkSVGFactory.js"() {
      init_Host();
      init_JsiSkSVG();
      JsiSkSVGFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        MakeFromData(data) {
          const decoder = new TextDecoder("utf-8");
          const str = decoder.decode(data.ref);
          return this.MakeFromString(str);
        }
        MakeFromString(str) {
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(str, "image/svg+xml");
          const svgElement = svgDoc.documentElement;
          const attrWidth = svgElement.getAttribute("width");
          const attrHeight = svgElement.getAttribute("height");
          let width = attrWidth ? parseFloat(attrWidth) : null;
          let height = attrHeight ? parseFloat(attrHeight) : null;
          const svgDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(str);
          const img = new Image();
          img.src = svgDataUrl;
          img.style.display = "none";
          img.alt = "SVG Image";
          if (!width || !height) {
            const viewBox = svgElement.getAttribute("viewBox");
            if (viewBox) {
              const viewBoxValues = viewBox.split(" ");
              if (viewBoxValues.length === 4) {
                width = width || parseFloat(viewBoxValues[2]);
                height = height || parseFloat(viewBoxValues[3]);
              }
            }
          }
          if (width && height) {
            img.width = width;
            img.height = height;
          }
          img.onerror = (e) => {
            console.error("SVG failed to load", e);
          };
          document.body.appendChild(img);
          return new JsiSkSVG(this.CanvasKit, img);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkTextBlobFactory.js
  var JsiSkTextBlobFactory;
  var init_JsiSkTextBlobFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkTextBlobFactory.js"() {
      init_Host();
      init_JsiSkFont();
      init_JsiSkTextBlob();
      init_JsiSkRSXform();
      JsiSkTextBlobFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        MakeFromText(str, font) {
          return new JsiSkTextBlob(this.CanvasKit, this.CanvasKit.TextBlob.MakeFromText(str, JsiSkFont.fromValue(font)));
        }
        MakeFromGlyphs(glyphs, font) {
          return new JsiSkTextBlob(this.CanvasKit, this.CanvasKit.TextBlob.MakeFromGlyphs(glyphs, JsiSkFont.fromValue(font)));
        }
        MakeFromRSXform(str, rsxforms, font) {
          return new JsiSkTextBlob(this.CanvasKit, this.CanvasKit.TextBlob.MakeFromRSXform(str, rsxforms.map((f) => Array.from(JsiSkRSXform.fromValue(f))).flat(), JsiSkFont.fromValue(font)));
        }
        MakeFromRSXformGlyphs(glyphs, rsxforms, font) {
          const transforms = rsxforms.flatMap((s) => Array.from(JsiSkRSXform.fromValue(s)));
          return new JsiSkTextBlob(this.CanvasKit, this.CanvasKit.TextBlob.MakeFromRSXformGlyphs(glyphs, transforms, JsiSkFont.fromValue(font)));
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkVerticesFactory.js
  var concat, MakeVertices;
  var init_JsiSkVerticesFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkVerticesFactory.js"() {
      init_JsiSkVertices();
      init_Host();
      concat = (...arrays) => {
        let totalLength = 0;
        for (const arr of arrays) {
          totalLength += arr.length;
        }
        const result = new Float32Array(totalLength);
        let offset = 0;
        for (const arr of arrays) {
          result.set(arr, offset);
          offset += arr.length;
        }
        return result;
      };
      MakeVertices = (CanvasKit, mode, positions, textureCoordinates, colors, indices, isVolatile) => new JsiSkVertices(CanvasKit, CanvasKit.MakeVertices(getEnum(CanvasKit, "VertexMode", mode), positions.map(({
        x,
        y
      }) => [x, y]).flat(), (textureCoordinates || []).map(({
        x,
        y
      }) => [x, y]).flat(), !colors ? null : colors.reduce((a, c) => concat(a, c)), indices, isVolatile));
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkTypefaceFontProvider.js
  var JsiSkTypefaceFontProvider, lengthBytesUTF8, stringToUTF8;
  var init_JsiSkTypefaceFontProvider = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkTypefaceFontProvider.js"() {
      init_Host();
      JsiSkTypefaceFontProvider = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "FontMgr");
        }
        matchFamilyStyle(_name, _style) {
          return throwNotImplementedOnRNWeb();
        }
        countFamilies() {
          return this.ref.countFamilies();
        }
        getFamilyName(index) {
          return this.ref.getFamilyName(index);
        }
        registerFont(typeface, familyName) {
          const strLen = lengthBytesUTF8(familyName) + 1;
          const strPtr = this.CanvasKit._malloc(strLen);
          stringToUTF8(this.CanvasKit, familyName, strPtr, strLen);
          this.ref._registerFont(typeface.ref, strPtr);
        }
      };
      lengthBytesUTF8 = (str) => {
        const encoder = new TextEncoder();
        const utf8 = encoder.encode(str);
        return utf8.length;
      };
      stringToUTF8 = (CanvasKit, str, outPtr, maxBytesToWrite) => {
        const encoder = new TextEncoder();
        const utf8 = encoder.encode(str);
        const heap = CanvasKit.HEAPU8;
        if (utf8.length > maxBytesToWrite) {
          throw new Error("Not enough space to write UTF8 encoded string");
        }
        for (let i = 0; i < utf8.length; i++) {
          heap[outPtr + i] = utf8[i];
        }
        if (utf8.length < maxBytesToWrite) {
          heap[outPtr + utf8.length] = 0;
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkTypefaceFontProviderFactory.js
  var JsiSkTypefaceFontProviderFactory;
  var init_JsiSkTypefaceFontProviderFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkTypefaceFontProviderFactory.js"() {
      init_Host();
      init_JsiSkTypefaceFontProvider();
      JsiSkTypefaceFontProviderFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        Make() {
          const tf = this.CanvasKit.TypefaceFontProvider.Make();
          return new JsiSkTypefaceFontProvider(this.CanvasKit, tf);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkFontMgr.js
  var JsiSkFontMgr;
  var init_JsiSkFontMgr = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkFontMgr.js"() {
      init_Host();
      JsiSkFontMgr = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "FontMgr");
        }
        dispose() {
          this[Symbol.dispose]();
        }
        countFamilies() {
          return this.ref.countFamilies();
        }
        getFamilyName(index) {
          return this.ref.getFamilyName(index);
        }
        matchFamilyStyle(_familyName, _fontStyle) {
          return throwNotImplementedOnRNWeb();
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkFontMgrFactory.js
  var JsiSkFontMgrFactory;
  var init_JsiSkFontMgrFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkFontMgrFactory.js"() {
      init_Host();
      init_JsiSkFontMgr();
      JsiSkFontMgrFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        System() {
          const fontMgr = this.CanvasKit.TypefaceFontProvider.Make();
          if (!fontMgr) {
            throw new Error("Couldn't create system font manager");
          }
          return new JsiSkFontMgr(this.CanvasKit, fontMgr);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkAnimatedImage.js
  var JsiSkAnimatedImage;
  var init_JsiSkAnimatedImage = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkAnimatedImage.js"() {
      init_Host();
      init_JsiSkImage();
      JsiSkAnimatedImage = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "AnimatedImage");
        }
        decodeNextFrame() {
          return this.ref.decodeNextFrame();
        }
        currentFrameDuration() {
          return this.ref.currentFrameDuration();
        }
        getFrameCount() {
          return this.ref.getFrameCount();
        }
        getCurrentFrame() {
          const image = this.ref.makeImageAtCurrentFrame();
          if (image === null) {
            return null;
          }
          return new JsiSkImage(this.CanvasKit, image);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkAnimatedImageFactory.js
  var JsiSkAnimatedImageFactory;
  var init_JsiSkAnimatedImageFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkAnimatedImageFactory.js"() {
      init_Host();
      init_JsiSkData();
      init_JsiSkAnimatedImage();
      JsiSkAnimatedImageFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        MakeAnimatedImageFromEncoded(encoded) {
          const image = this.CanvasKit.MakeAnimatedImageFromEncoded(JsiSkData.fromValue(encoded));
          if (image === null) {
            return null;
          }
          return new JsiSkAnimatedImage(this.CanvasKit, image);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkParagraph.js
  var JsiSkParagraph;
  var init_JsiSkParagraph = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkParagraph.js"() {
      init_Host();
      init_JsiSkRect();
      JsiSkParagraph = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "Paragraph");
        }
        getMinIntrinsicWidth() {
          return this.ref.getMinIntrinsicWidth();
        }
        getMaxIntrinsicWidth() {
          return this.ref.getMaxIntrinsicWidth();
        }
        getLongestLine() {
          return this.ref.getLongestLine();
        }
        layout(width) {
          this.ref.layout(width);
        }
        paint(canvas, x, y) {
          canvas.ref.drawParagraph(this.ref, x, y);
        }
        getHeight() {
          return this.ref.getHeight();
        }
        getMaxWidth() {
          return this.ref.getMaxWidth();
        }
        getGlyphPositionAtCoordinate(x, y) {
          return this.ref.getGlyphPositionAtCoordinate(x, y).pos;
        }
        getRectsForPlaceholders() {
          return this.ref.getRectsForPlaceholders().map(({
            rect,
            dir
          }) => ({
            rect: new JsiSkRect(this.CanvasKit, rect),
            direction: dir.value
          }));
        }
        getRectsForRange(start, end) {
          return this.ref.getRectsForRange(
            start,
            end,
            {
              value: 0
            },
            {
              value: 0
            }
            /** kTight */
          ).map(({
            rect
          }) => new JsiSkRect(this.CanvasKit, rect));
        }
        getLineMetrics() {
          return this.ref.getLineMetrics();
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkTextStyle.js
  var JsiSkTextStyle;
  var init_JsiSkTextStyle = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkTextStyle.js"() {
      JsiSkTextStyle = class {
        static toTextStyle(value) {
          return {
            backgroundColor: value.backgroundColor,
            color: value.color,
            decoration: value.decoration,
            decorationColor: value.decorationColor,
            decorationStyle: value.decorationStyle ? {
              value: value.decorationStyle
            } : void 0,
            decorationThickness: value.decorationThickness,
            fontFamilies: value.fontFamilies,
            fontSize: value.fontSize,
            fontStyle: value.fontStyle ? {
              slant: value.fontStyle.slant ? {
                value: value.fontStyle.slant
              } : void 0,
              weight: value.fontStyle.weight ? {
                value: value.fontStyle.weight
              } : void 0,
              width: value.fontStyle.width ? {
                value: value.fontStyle.width
              } : void 0
            } : void 0,
            fontFeatures: value.fontFeatures,
            foregroundColor: value.foregroundColor,
            fontVariations: value.fontVariations,
            halfLeading: value.halfLeading,
            heightMultiplier: value.heightMultiplier,
            letterSpacing: value.letterSpacing,
            locale: value.locale,
            shadows: value.shadows ? value.shadows.map((shadow) => ({
              blurRadius: shadow.blurRadius,
              color: shadow.color,
              offset: shadow.offset ? [shadow.offset.x, shadow.offset.y] : void 0
            })) : void 0,
            textBaseline: value.textBaseline ? {
              value: value.textBaseline
            } : void 0,
            wordSpacing: value.wordSpacing
          };
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkParagraphBuilder.js
  var JsiSkParagraphBuilder;
  var init_JsiSkParagraphBuilder = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkParagraphBuilder.js"() {
      init_types2();
      init_Host();
      init_JsiSkParagraph();
      init_JsiSkTextStyle();
      init_JsiSkPaint();
      JsiSkParagraphBuilder = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "ParagraphBuilder");
        }
        addPlaceholder(width = 0, height = 0, alignment = PlaceholderAlignment.Baseline, baseline = TextBaseline.Alphabetic, offset = 0) {
          this.ref.addPlaceholder(width, height, {
            value: alignment
          }, {
            value: baseline
          }, offset);
          return this;
        }
        addText(text) {
          this.ref.addText(text);
          return this;
        }
        build() {
          return new JsiSkParagraph(this.CanvasKit, this.ref.build());
        }
        reset() {
          this.ref.reset();
        }
        pushStyle(style2, foregroundPaint, backgroundPaint) {
          const textStyle = JsiSkTextStyle.toTextStyle(style2);
          if (foregroundPaint || backgroundPaint) {
            var _textStyle$color, _textStyle$background;
            const fg = foregroundPaint ? JsiSkPaint.fromValue(foregroundPaint) : this.makePaint((_textStyle$color = textStyle.color) !== null && _textStyle$color !== void 0 ? _textStyle$color : Float32Array.of(0, 0, 0, 1));
            const bg = backgroundPaint ? JsiSkPaint.fromValue(backgroundPaint) : this.makePaint((_textStyle$background = textStyle.backgroundColor) !== null && _textStyle$background !== void 0 ? _textStyle$background : Float32Array.of(0, 0, 0, 0));
            this.ref.pushPaintStyle(new this.CanvasKit.TextStyle(textStyle), fg, bg);
          } else {
            this.ref.pushStyle(new this.CanvasKit.TextStyle(textStyle));
          }
          return this;
        }
        pop() {
          this.ref.pop();
          return this;
        }
        makePaint(color) {
          const paint = new this.CanvasKit.Paint();
          paint.setColor(color);
          return paint;
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkParagraphStyle.js
  var JsiSkParagraphStyle;
  var init_JsiSkParagraphStyle = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkParagraphStyle.js"() {
      init_types2();
      JsiSkParagraphStyle = class {
        static toParagraphStyle(ck, value) {
          var _value$disableHinting, _value$ellipsis, _value$heightMultipli, _value$maxLines, _value$replaceTabChar, _ps$strutStyle, _value$strutStyle$fon, _value$strutStyle, _value$strutStyle$fon2, _value$strutStyle2, _value$strutStyle$hei, _value$strutStyle3, _value$strutStyle$lea, _value$strutStyle4, _value$strutStyle$for, _value$strutStyle5, _ps$strutStyle$fontSt, _value$strutStyle6, _value$strutStyle7, _value$strutStyle8, _value$strutStyle$hal, _value$strutStyle9, _value$strutStyle$str, _value$strutStyle0;
          const ps = new ck.ParagraphStyle({
            textStyle: {
              color: ck.BLACK
            }
          });
          ps.disableHinting = (_value$disableHinting = value.disableHinting) !== null && _value$disableHinting !== void 0 ? _value$disableHinting : ps.disableHinting;
          ps.ellipsis = (_value$ellipsis = value.ellipsis) !== null && _value$ellipsis !== void 0 ? _value$ellipsis : ps.ellipsis;
          ps.heightMultiplier = (_value$heightMultipli = value.heightMultiplier) !== null && _value$heightMultipli !== void 0 ? _value$heightMultipli : ps.heightMultiplier;
          ps.maxLines = (_value$maxLines = value.maxLines) !== null && _value$maxLines !== void 0 ? _value$maxLines : ps.maxLines;
          ps.replaceTabCharacters = (_value$replaceTabChar = value.replaceTabCharacters) !== null && _value$replaceTabChar !== void 0 ? _value$replaceTabChar : ps.replaceTabCharacters;
          ps.textAlign = value.textAlign !== void 0 ? {
            value: value.textAlign
          } : ps.textAlign;
          ps.textDirection = value.textDirection !== void 0 ? {
            value: value.textDirection === TextDirection.LTR ? 1 : 0
          } : ps.textDirection;
          ps.textHeightBehavior = value.textHeightBehavior !== void 0 ? {
            value: value.textHeightBehavior
          } : ps.textHeightBehavior;
          ps.strutStyle = (_ps$strutStyle = ps.strutStyle) !== null && _ps$strutStyle !== void 0 ? _ps$strutStyle : {};
          ps.strutStyle.fontFamilies = (_value$strutStyle$fon = (_value$strutStyle = value.strutStyle) === null || _value$strutStyle === void 0 ? void 0 : _value$strutStyle.fontFamilies) !== null && _value$strutStyle$fon !== void 0 ? _value$strutStyle$fon : ps.strutStyle.fontFamilies;
          ps.strutStyle.fontSize = (_value$strutStyle$fon2 = (_value$strutStyle2 = value.strutStyle) === null || _value$strutStyle2 === void 0 ? void 0 : _value$strutStyle2.fontSize) !== null && _value$strutStyle$fon2 !== void 0 ? _value$strutStyle$fon2 : ps.strutStyle.fontSize;
          ps.strutStyle.heightMultiplier = (_value$strutStyle$hei = (_value$strutStyle3 = value.strutStyle) === null || _value$strutStyle3 === void 0 ? void 0 : _value$strutStyle3.heightMultiplier) !== null && _value$strutStyle$hei !== void 0 ? _value$strutStyle$hei : ps.strutStyle.heightMultiplier;
          ps.strutStyle.leading = (_value$strutStyle$lea = (_value$strutStyle4 = value.strutStyle) === null || _value$strutStyle4 === void 0 ? void 0 : _value$strutStyle4.leading) !== null && _value$strutStyle$lea !== void 0 ? _value$strutStyle$lea : ps.strutStyle.leading;
          ps.strutStyle.forceStrutHeight = (_value$strutStyle$for = (_value$strutStyle5 = value.strutStyle) === null || _value$strutStyle5 === void 0 ? void 0 : _value$strutStyle5.forceStrutHeight) !== null && _value$strutStyle$for !== void 0 ? _value$strutStyle$for : ps.strutStyle.forceStrutHeight;
          ps.strutStyle.fontStyle = (_ps$strutStyle$fontSt = ps.strutStyle.fontStyle) !== null && _ps$strutStyle$fontSt !== void 0 ? _ps$strutStyle$fontSt : {};
          ps.strutStyle.fontStyle.slant = ((_value$strutStyle6 = value.strutStyle) === null || _value$strutStyle6 === void 0 || (_value$strutStyle6 = _value$strutStyle6.fontStyle) === null || _value$strutStyle6 === void 0 ? void 0 : _value$strutStyle6.slant) !== void 0 ? {
            value: value.strutStyle.fontStyle.slant
          } : ps.strutStyle.fontStyle.slant;
          ps.strutStyle.fontStyle.width = ((_value$strutStyle7 = value.strutStyle) === null || _value$strutStyle7 === void 0 || (_value$strutStyle7 = _value$strutStyle7.fontStyle) === null || _value$strutStyle7 === void 0 ? void 0 : _value$strutStyle7.width) !== void 0 ? {
            value: value.strutStyle.fontStyle.width
          } : ps.strutStyle.fontStyle.width;
          ps.strutStyle.fontStyle.weight = ((_value$strutStyle8 = value.strutStyle) === null || _value$strutStyle8 === void 0 || (_value$strutStyle8 = _value$strutStyle8.fontStyle) === null || _value$strutStyle8 === void 0 ? void 0 : _value$strutStyle8.weight) !== void 0 ? {
            value: value.strutStyle.fontStyle.weight
          } : ps.strutStyle.fontStyle.weight;
          ps.strutStyle.halfLeading = (_value$strutStyle$hal = (_value$strutStyle9 = value.strutStyle) === null || _value$strutStyle9 === void 0 ? void 0 : _value$strutStyle9.halfLeading) !== null && _value$strutStyle$hal !== void 0 ? _value$strutStyle$hal : ps.strutStyle.halfLeading;
          ps.strutStyle.strutEnabled = (_value$strutStyle$str = (_value$strutStyle0 = value.strutStyle) === null || _value$strutStyle0 === void 0 ? void 0 : _value$strutStyle0.strutEnabled) !== null && _value$strutStyle$str !== void 0 ? _value$strutStyle$str : ps.strutStyle.strutEnabled;
          return ps;
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkParagraphBuilderFactory.js
  var JsiSkParagraphBuilderFactory;
  var init_JsiSkParagraphBuilderFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkParagraphBuilderFactory.js"() {
      init_Host();
      init_JsiSkParagraphBuilder();
      init_JsiSkParagraphStyle();
      init_JsiSkTypefaceFontProvider();
      JsiSkParagraphBuilderFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        Make(paragraphStyle, typefaceProvider) {
          const style2 = new this.CanvasKit.ParagraphStyle(JsiSkParagraphStyle.toParagraphStyle(this.CanvasKit, paragraphStyle !== null && paragraphStyle !== void 0 ? paragraphStyle : {}));
          if (typefaceProvider === void 0) {
            throw new Error("SkTypefaceFontProvider is required on React Native Web.");
          }
          const fontCollection = this.CanvasKit.FontCollection.Make();
          fontCollection.setDefaultFontManager(JsiSkTypefaceFontProvider.fromValue(typefaceProvider));
          fontCollection.enableFontFallback();
          return new JsiSkParagraphBuilder(this.CanvasKit, this.CanvasKit.ParagraphBuilder.MakeFromFontCollection(style2, fontCollection));
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkNativeBufferFactory.js
  var JsiSkNativeBufferFactory;
  var init_JsiSkNativeBufferFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkNativeBufferFactory.js"() {
      init_Host();
      JsiSkNativeBufferFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        MakeFromImage(image) {
          const info = image.getImageInfo();
          const uint8ClampedArray = new Uint8ClampedArray(image.readPixels());
          const imageData = new ImageData(uint8ClampedArray, info.width, info.height);
          const canvas = new OffscreenCanvas(info.width, info.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Failed to get 2d context from canvas");
          }
          ctx.putImageData(imageData, 0, 0);
          return canvas;
        }
        Release(_nativeBuffer) {
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/CanvasKitWebGLBufferImpl.js
  function _defineProperty2(e, r, t) {
    return (r = _toPropertyKey2(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: true, configurable: true, writable: true }) : e[r] = t, e;
  }
  function _toPropertyKey2(t) {
    var i = _toPrimitive2(t, "string");
    return "symbol" == typeof i ? i : i + "";
  }
  function _toPrimitive2(t, r) {
    if ("object" != typeof t || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r || "default");
      if ("object" != typeof i) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  var CanvasKitWebGLBufferImpl;
  var init_CanvasKitWebGLBufferImpl = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/CanvasKitWebGLBufferImpl.js"() {
      init_types2();
      CanvasKitWebGLBufferImpl = class extends CanvasKitWebGLBuffer {
        constructor(surface, source) {
          super();
          this.surface = surface;
          this.source = source;
          _defineProperty2(this, "image", null);
        }
        toImage() {
          if (this.image === null) {
            this.image = this.surface.makeImageFromTextureSource(this.source);
          }
          if (this.image === null) {
            throw new Error("Failed to create image from texture source");
          }
          this.surface.updateTextureFromSource(this.image, this.source);
          return this.image;
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiVideo.js
  function _defineProperty3(e, r, t) {
    return (r = _toPropertyKey3(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: true, configurable: true, writable: true }) : e[r] = t, e;
  }
  function _toPropertyKey3(t) {
    var i = _toPrimitive3(t, "string");
    return "symbol" == typeof i ? i : i + "";
  }
  function _toPrimitive3(t, r) {
    if ("object" != typeof t || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r || "default");
      if ("object" != typeof i) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }
  var createVideo, JsiVideo;
  var init_JsiVideo = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiVideo.js"() {
      init_CanvasKitWebGLBufferImpl();
      init_JsiSkImageFactory();
      init_Host();
      createVideo = async (CanvasKit, url) => {
        const video = document.createElement("video");
        return new Promise((resolve, reject) => {
          video.src = url;
          video.style.display = "none";
          video.crossOrigin = "anonymous";
          video.volume = 0;
          video.addEventListener("loadedmetadata", () => {
            document.body.appendChild(video);
            resolve(new JsiVideo(new JsiSkImageFactory(CanvasKit), video));
          });
          video.addEventListener("error", () => {
            reject(new Error(`Failed to load video from URL: ${url}`));
          });
        });
      };
      JsiVideo = class {
        constructor(ImageFactory, videoElement) {
          this.ImageFactory = ImageFactory;
          this.videoElement = videoElement;
          _defineProperty3(this, "__typename__", "Video");
          _defineProperty3(this, "webglBuffer", null);
          document.body.appendChild(this.videoElement);
        }
        duration() {
          return this.videoElement.duration * 1e3;
        }
        framerate() {
          return throwNotImplementedOnRNWeb();
        }
        currentTime() {
          return this.videoElement.currentTime * 1e3;
        }
        setSurface(surface) {
          this.webglBuffer = new CanvasKitWebGLBufferImpl(surface, this.videoElement);
        }
        nextImage() {
          return this.ImageFactory.MakeImageFromNativeBuffer(this.webglBuffer ? this.webglBuffer : this.videoElement);
        }
        seek(time) {
          if (isNaN(time)) {
            throw new Error(`Invalid time: ${time}`);
          }
          this.videoElement.currentTime = time / 1e3;
        }
        rotation() {
          return 0;
        }
        size() {
          return {
            width: this.videoElement.videoWidth,
            height: this.videoElement.videoHeight
          };
        }
        pause() {
          this.videoElement.pause();
        }
        play() {
          this.videoElement.play();
        }
        setVolume(volume) {
          this.videoElement.volume = volume;
        }
        setLooping(looping) {
          this.videoElement.loop = looping;
        }
        isPlaying() {
          return !this.videoElement.paused && !this.videoElement.ended;
        }
        [Symbol.dispose]() {
          if (this.videoElement.parentNode) {
            this.videoElement.parentNode.removeChild(this.videoElement);
          }
        }
        dispose() {
          this[Symbol.dispose]();
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkottieAnimation.js
  var JsiSkottieAnimation;
  var init_JsiSkottieAnimation = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkottieAnimation.js"() {
      init_Host();
      init_JsiSkTypeface();
      init_JsiSkColor();
      init_JsiSkRect();
      JsiSkottieAnimation = class extends HostObject {
        constructor(CanvasKit, ref) {
          super(CanvasKit, ref, "SkottieAnimation");
        }
        getOpacityProps() {
          return this.ref.getOpacityProps();
        }
        getTextProps() {
          return this.ref.getTextProps();
        }
        getColorProps() {
          return this.ref.getColorProps().map(({
            key,
            value
          }) => ({
            key,
            value: Color(value)
          }));
        }
        getTransformProps() {
          return this.ref.getTransformProps().map(({
            key,
            value
          }) => ({
            key,
            value: {
              anchor: {
                x: value.anchor[0],
                y: value.anchor[1]
              },
              position: {
                x: value.position[0],
                y: value.position[1]
              },
              scale: {
                x: value.scale[0],
                y: value.scale[1]
              },
              rotation: value.rotation,
              skew: value.skew,
              skewAxis: value.skew_axis
            }
          }));
        }
        setColor(key, color) {
          return this.ref.setColor(key, color);
        }
        setText(key, text, size) {
          return this.ref.setText(key, text, size);
        }
        setOpacity(key, opacity) {
          return this.ref.setOpacity(key, opacity);
        }
        setTransform(key, anchor, position, scale, rotation, skew, skewAxis) {
          const a = Float32Array.of(anchor.x, anchor.y);
          const p = Float32Array.of(position.x, position.y);
          const s = Float32Array.of(scale.x, scale.y);
          return this.ref.setTransform(key, a, p, s, rotation, skew, skewAxis);
        }
        getSlotInfo() {
          return this.ref.getSlotInfo();
        }
        setColorSlot(key, color) {
          return this.ref.setColorSlot(key, color);
        }
        setScalarSlot(key, scalar) {
          return this.ref.setScalarSlot(key, scalar);
        }
        setVec2Slot(key, vec2) {
          return this.ref.setVec2Slot(key, Float32Array.of(vec2.x, vec2.y));
        }
        setTextSlot(key, text) {
          var _text$text, _text$textSize, _text$minTextSize, _text$maxTextSize, _text$strokeWidth, _text$lineHeight, _text$lineShift;
          const txt = {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            typeface: text.typeface && text.typeface instanceof JsiSkTypeface ? text.typeface.ref : null,
            text: (_text$text = text.text) !== null && _text$text !== void 0 ? _text$text : "",
            textSize: (_text$textSize = text.textSize) !== null && _text$textSize !== void 0 ? _text$textSize : 0,
            minTextSize: (_text$minTextSize = text.minTextSize) !== null && _text$minTextSize !== void 0 ? _text$minTextSize : 0,
            maxTextSize: (_text$maxTextSize = text.maxTextSize) !== null && _text$maxTextSize !== void 0 ? _text$maxTextSize : Number.MAX_VALUE,
            strokeWidth: (_text$strokeWidth = text.strokeWidth) !== null && _text$strokeWidth !== void 0 ? _text$strokeWidth : 0,
            lineHeight: (_text$lineHeight = text.lineHeight) !== null && _text$lineHeight !== void 0 ? _text$lineHeight : 0,
            lineShift: (_text$lineShift = text.lineShift) !== null && _text$lineShift !== void 0 ? _text$lineShift : 0,
            ascent: text.ascent,
            maxLines: text.maxLines,
            // TODO: implement
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-expect-error
            horizAlign: this.CanvasKit.TextAlign.Left,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-expect-error
            vertAlign: this.CanvasKit.VerticalTextAlign.Top,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-expect-error
            strokeJoin: this.CanvasKit.StrokeJoin.Miter,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-expect-error
            direction: this.CanvasKit.TextDirection.LTR,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            linebreak: this.CanvasKit.LineBreakType.HardLineBreak,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            resize: this.CanvasKit.ResizePolicy.None,
            boundingBox: text.boundingBox ? this.CanvasKit.XYWHRect(text.boundingBox.x, text.boundingBox.y, text.boundingBox.width, text.boundingBox.height) : [0, 0, 0, 0],
            fillColor: text.fillColor ? Color(text.fillColor) : this.CanvasKit.TRANSPARENT,
            strokeColor: text.strokeColor ? Color(text.strokeColor) : this.CanvasKit.TRANSPARENT
          };
          return this.ref.setTextSlot(key, txt);
        }
        setImageSlot(key, assetName) {
          return this.ref.setImageSlot(key, assetName);
        }
        getColorSlot(key) {
          const color = this.ref.getColorSlot(key);
          return color;
        }
        getScalarSlot(key) {
          return this.ref.getScalarSlot(key);
        }
        getVec2Slot(key) {
          const vec2 = this.ref.getVec2Slot(key);
          if (!vec2) {
            return null;
          }
          return {
            x: vec2[0],
            y: vec2[1]
          };
        }
        getTextSlot(key) {
          const result = this.ref.getTextSlot(key);
          const textSlot = {};
          if (result) {
            if (result.typeface) {
              textSlot.typeface = new JsiSkTypeface(this.CanvasKit, result.typeface);
            }
            if (result.text) {
              textSlot.text = result.text;
            }
            if (result.textSize) {
              textSlot.textSize = result.textSize;
            }
            if (result.minTextSize) {
              textSlot.minTextSize = result.minTextSize;
            }
            if (result.maxTextSize) {
              textSlot.maxTextSize = result.maxTextSize;
            }
            if (result.strokeWidth) {
              textSlot.strokeWidth = result.strokeWidth;
            }
            if (result.lineHeight) {
              textSlot.lineHeight = result.lineHeight;
            }
            if (result.lineShift) {
              textSlot.lineShift = result.lineShift;
            }
            if (result.ascent) {
              textSlot.ascent = result.ascent;
            }
            if (result.maxLines) {
              textSlot.maxLines = result.maxLines;
            }
          }
          return textSlot;
        }
        duration() {
          return this.ref.duration();
        }
        fps() {
          return this.ref.fps();
        }
        render(canvas, dstRect) {
          const [width, height] = this.ref.size();
          this.ref.render(canvas.ref, dstRect && dstRect instanceof JsiSkRect ? dstRect.ref : Float32Array.of(0, 0, width, height));
        }
        seekFrame(frame, damageRect) {
          const result = this.ref.seekFrame(frame);
          if (damageRect && damageRect instanceof JsiSkRect) {
            damageRect.ref[0] = result[0];
            damageRect.ref[1] = result[1];
            damageRect.ref[2] = result[2];
            damageRect.ref[3] = result[3];
          }
        }
        size() {
          const [width, height] = this.ref.size();
          return {
            width,
            height
          };
        }
        version() {
          return this.ref.version();
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkottieFactory.js
  var JsiSkottieFactory;
  var init_JsiSkottieFactory = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkottieFactory.js"() {
      init_Host();
      init_JsiSkottieAnimation();
      JsiSkottieFactory = class extends Host {
        constructor(CanvasKit) {
          super(CanvasKit);
        }
        Make(json, assets) {
          const rawAssets = {};
          for (const [key, value] of Object.entries(assets !== null && assets !== void 0 ? assets : {})) {
            rawAssets[key] = value.ref;
          }
          const animation = this.CanvasKit.MakeManagedAnimation(json, rawAssets);
          if (!animation) {
            throw new Error("Failed to create SkottieAnimation");
          }
          return new JsiSkottieAnimation(this.CanvasKit, animation);
        }
      };
    }
  });

  // ../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkia.js
  var JsiSkApi;
  var init_JsiSkia = __esm({
    "../twist-mobile-develop/node_modules/@shopify/react-native-skia/lib/module/skia/web/JsiSkia.js"() {
      init_JsiSkPoint();
      init_JsiSkPaint();
      init_JsiSkRect();
      init_JsiSkColor();
      init_JsiSkSurfaceFactory();
      init_JsiSkRRect();
      init_JsiSkRSXform();
      init_JsiSkContourMeasureIter();
      init_JsiSkPictureRecorder();
      init_JsiSkPictureFactory();
      init_JsiSkPathFactory();
      init_JsiSkPathBuilderFactory();
      init_JsiSkMatrix();
      init_JsiSkColorFilterFactory();
      init_JsiSkTypefaceFactory();
      init_JsiSkMaskFilterFactory();
      init_JsiSkRuntimeEffectFactory();
      init_JsiSkImageFilterFactory();
      init_JsiSkShaderFactory();
      init_JsiSkPathEffectFactory();
      init_JsiSkDataFactory();
      init_JsiSkImageFactory();
      init_JsiSkSVGFactory();
      init_JsiSkTextBlobFactory();
      init_JsiSkFont();
      init_JsiSkVerticesFactory();
      init_JsiSkPath();
      init_JsiSkTypeface();
      init_JsiSkTypefaceFontProviderFactory();
      init_JsiSkFontMgrFactory();
      init_JsiSkAnimatedImageFactory();
      init_JsiSkParagraphBuilderFactory();
      init_JsiSkNativeBufferFactory();
      init_JsiVideo();
      init_Host();
      init_JsiSkottieFactory();
      JsiSkApi = (CanvasKit) => ({
        Point: (x, y) => new JsiSkPoint(CanvasKit, Float32Array.of(x, y)),
        RuntimeShaderBuilder: (_) => {
          return throwNotImplementedOnRNWeb();
        },
        RRectXY: (rect, rx, ry) => new JsiSkRRect(CanvasKit, rect, rx, ry),
        RSXform: (scos, ssin, tx, ty) => new JsiSkRSXform(CanvasKit, Float32Array.of(scos, ssin, tx, ty)),
        RSXformFromRadians: (scale, r, tx, ty, px, py) => {
          const s = Math.sin(r) * scale;
          const c = Math.cos(r) * scale;
          return new JsiSkRSXform(CanvasKit, Float32Array.of(c, s, tx - c * px + s * py, ty - s * px - c * py));
        },
        Color,
        ContourMeasureIter: (path, forceClosed, resScale) => (() => {
          const p = JsiSkPath.pathFromValue(path);
          const iter = new JsiSkContourMeasureIter(CanvasKit, new CanvasKit.ContourMeasureIter(p, forceClosed, resScale));
          p.delete();
          return iter;
        })(),
        Paint: () => {
          const paint = new JsiSkPaint(CanvasKit, new CanvasKit.Paint());
          paint.setAntiAlias(true);
          return paint;
        },
        PictureRecorder: () => new JsiSkPictureRecorder(CanvasKit, new CanvasKit.PictureRecorder()),
        Picture: new JsiSkPictureFactory(CanvasKit),
        Path: new JsiSkPathFactory(CanvasKit),
        PathBuilder: new JsiSkPathBuilderFactory(CanvasKit),
        Matrix: (matrix) => new JsiSkMatrix(CanvasKit, matrix ? Float32Array.of(...matrix) : Float32Array.of(...CanvasKit.Matrix.identity())),
        ColorFilter: new JsiSkColorFilterFactory(CanvasKit),
        Font: (typeface, size) => new JsiSkFont(CanvasKit, new CanvasKit.Font(typeface === void 0 ? null : JsiSkTypeface.fromValue(typeface), size)),
        Typeface: new JsiSkTypefaceFactory(CanvasKit),
        MaskFilter: new JsiSkMaskFilterFactory(CanvasKit),
        RuntimeEffect: new JsiSkRuntimeEffectFactory(CanvasKit),
        ImageFilter: new JsiSkImageFilterFactory(CanvasKit),
        Shader: new JsiSkShaderFactory(CanvasKit),
        PathEffect: new JsiSkPathEffectFactory(CanvasKit),
        MakeVertices: MakeVertices.bind(null, CanvasKit),
        Data: new JsiSkDataFactory(CanvasKit),
        Image: new JsiSkImageFactory(CanvasKit),
        AnimatedImage: new JsiSkAnimatedImageFactory(CanvasKit),
        SVG: new JsiSkSVGFactory(CanvasKit),
        TextBlob: new JsiSkTextBlobFactory(CanvasKit),
        XYWHRect: (x, y, width, height) => {
          return new JsiSkRect(CanvasKit, CanvasKit.XYWHRect(x, y, width, height));
        },
        Surface: new JsiSkSurfaceFactory(CanvasKit),
        TypefaceFontProvider: new JsiSkTypefaceFontProviderFactory(CanvasKit),
        FontMgr: new JsiSkFontMgrFactory(CanvasKit),
        ParagraphBuilder: new JsiSkParagraphBuilderFactory(CanvasKit),
        NativeBuffer: new JsiSkNativeBufferFactory(CanvasKit),
        Skottie: new JsiSkottieFactory(CanvasKit),
        Video: createVideo.bind(null, CanvasKit),
        Context: (_surface, _width, _height) => {
          return throwNotImplementedOnRNWeb();
        },
        Recorder: () => {
          return throwNotImplementedOnRNWeb();
        },
        getDevice: () => {
          return throwNotImplementedOnRNWeb();
        },
        hasDevice: () => {
          return false;
        }
      });
    }
  });

  // twist-rig/test/browser-entry.ts
  var require_browser_entry = __commonJS({
    "twist-rig/test/browser-entry.ts"() {
      init_src();
      init_JsiSkia();
      window.TwistRig = src_exports;
      window.JsiSkApi = JsiSkApi;
    }
  });
  require_browser_entry();
})();
