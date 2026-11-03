// Twist skeletal-vector engine — Rive's approach, no Rive dependency.
// Same model and maths as rive-runtime (read from its source, see riv/FINDINGS.md):
//   • transform hierarchy: local = T(x,y)·R(rotation)·S(scaleX,scaleY); world = parentWorld · local
//   • bones: a child Bone sits at x = parent bone's length, y = 0
//   • skinning: per tendon M = boneWorld · inverse(bind); vertex' = Σ wᵢ·Mᵢ · (skinBind · v), 4 bones/vertex,
//     weights & indices packed 8 bits each; cubic handles carry their own weights (CubicWeight)
//   • paths: straight / cubic (detached, mirrored, asymmetric) vertices, "natural rounding" corner radius
//   • paints: Fill / Stroke with SolidColor / Linear / Radial gradients, drawn in paint order
//   • draw order: reverse component order (first in the hierarchy = on top); Solo shows one child;
//     ClippingShape clips the parent's subtree
//   • animation: keyed properties, keyframes hold / linear / cubic-bezier / elastic, colours lerp per channel
//
// A model is { width, height, components: [{ type, parent, p: {props}, is: {transform,drawable,…} }],
//              animations: [...], interpolators: {index: {...}} } — see engine/from-riv.mjs.

// ── 2D affine matrices [xx, xy, yx, yy, tx, ty]  (x' = xx·x + yx·y + tx,  y' = xy·x + yy·y + ty) ──
export const I = () => [1, 0, 0, 1, 0, 0];
export const mul = (a, b) => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
export const inv = m => {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!det) return I();
  const d = 1 / det;
  return [m[3] * d, -m[1] * d, -m[2] * d, m[0] * d, (m[2] * m[5] - m[3] * m[4]) * d, (m[1] * m[4] - m[0] * m[5]) * d];
};
export const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const local = p => {
  const c = Math.cos(p.rotation ?? 0), s = Math.sin(p.rotation ?? 0), sx = p.scaleX ?? 1, sy = p.scaleY ?? 1;
  return [c * sx, s * sx, -s * sy, c * sy, p.x ?? 0, p.y ?? 0];
};
const fromProps = p => [p.xx ?? 1, p.xy ?? 0, p.yx ?? 0, p.yy ?? 1, p.tx ?? 0, p.ty ?? 0];

// ── easing ──
function cubicEase(x1, y1, x2, y2) {
  const bz = (t, a1, a2) => (((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t + 3 * a1) * t;
  const slope = (t, a1, a2) => 3 * (1 - 3 * a2 + 3 * a1) * t * t + 2 * (3 * a2 - 6 * a1) * t + 3 * a1;
  return x => {
    if (x <= 0 || x >= 1) return x <= 0 ? 0 : 1;
    let t = x; // Newton, then bisection fallback
    for (let i = 0; i < 8; i++) { const s = slope(t, x1, x2); if (Math.abs(s) < 1e-6) break; t -= (bz(t, x1, x2) - x) / s; }
    if (t < 0 || t > 1 || Math.abs(bz(t, x1, x2) - x) > 1e-5) { let a = 0, b = 1; for (let i = 0; i < 40; i++) { t = (a + b) / 2; bz(t, x1, x2) < x ? a = t : b = t; } }
    return bz(t, y1, y2);
  };
}
function elasticEase(easing = 1, amplitude = 1, period = 1) {
  const s = amplitude < 1 ? period / 4 : period / (2 * Math.PI) * Math.asin(1 / amplitude);
  const amp = time => { if (amplitude < 1) { const t = Math.abs(s), a = Math.abs(time); if (a < t) { const l = a / t; return amplitude * l + (1 - l); } } return amplitude; };
  const out = f => amp(f) * 2 ** (-10 * f) * Math.sin((f - s) * 2 * Math.PI / period) + 1;
  const inn = f => { const t = f - 1; return -(amp(t) * 2 ** (10 * t) * Math.sin((-t - s) * 2 * Math.PI / period)); };
  const io = f => { const t = f * 2 - 1, a = amp(t); return t < 0 ? -0.5 * a * 2 ** (10 * t) * Math.sin((-t - s) * 2 * Math.PI / period) : 0.5 * (a * 2 ** (-10 * t) * Math.sin((t - s) * 2 * Math.PI / period)) + 1; };
  return [inn, out, io][easing] || out;
}
const lerpColor = (a, b, t) => {
  let r = 0;
  for (let sh = 0; sh < 32; sh += 8) { const ca = (a >>> sh) & 255, cb = (b >>> sh) & 255; r |= Math.round(ca + (cb - ca) * t) << sh; }
  return r >>> 0;
};

export class Scene {
  constructor(model) {
    this.model = model;
    this.c = model.components;
    this.base = this.c.map(o => ({ ...o.p }));
    this.kids = this.c.map(() => []);
    this.c.forEach((o, i) => { if (i && o.parent != null && this.kids[o.parent]) this.kids[o.parent].push(i); });
    const ofType = (i, re) => this.kids[i].filter(j => re.test(this.c[j].type));
    this.paths = {}; this.verts = {}; this.paints = {}; this.skinOf = {}; this.tendons = {}; this.weightOf = {}; this.stops = {}; this.clips = {};
    this.c.forEach((o, i) => {
      if (o.type === 'Shape') { this.paths[i] = this.kids[i].filter(j => this.c[j].is.path); this.paints[i] = ofType(i, /^(Fill|Stroke)$/); }
      if (this.c[i].is.path) { this.verts[i] = this.kids[i].filter(j => this.c[j].is.vertex); this.skinOf[i] = ofType(i, /^Skin$/)[0]; }
      if (o.type === 'Skin') this.tendons[i] = ofType(i, /^Tendon$/);
      if (this.c[i].is.vertex) this.weightOf[i] = ofType(i, /Weight$/)[0];
      if (/Gradient$/.test(o.type)) this.stops[i] = ofType(i, /^GradientStop$/);
      if (o.type === 'ClippingShape') (this.clips[o.parent] ||= []).push(i);
    });
    this.drawables = this.c.map((o, i) => i).filter(i => this.c[i].type === 'Shape').reverse();
    this.ease = {};
    for (const [k, it] of Object.entries(model.interpolators || {}))
      this.ease[k] = it.type === 'ElasticInterpolator' ? elasticEase(it.p.easingValue, it.p.amplitude, it.p.period) : cubicEase(it.p.x1 ?? 0.42, it.p.y1 ?? 0, it.p.x2 ?? 0.58, it.p.y2 ?? 1);
  }

  reset() { this.c.forEach((o, i) => { o.p = { ...this.base[i] }; }); }

  // Apply one animation at `seconds` on top of the current state (mix 1).
  applyAnimation(anim, seconds) {
    const fps = anim.fps ?? 60;
    for (const ko of anim.keyed) {
      const o = this.c[ko.objectId]; if (!o) continue;
      for (const kp of ko.props) {
        const fr = kp.frames; if (!fr.length) continue;
        const v = k => k[kp.valueKey];
        const t = seconds * fps;
        let value;
        if (t <= fr[0].frame) value = v(fr[0]);
        else if (t >= fr[fr.length - 1].frame) value = v(fr[fr.length - 1]);
        else {
          let i = 0; while (fr[i + 1].frame <= t) i++;
          const a = fr[i], b = fr[i + 1], it = a.interpolationType ?? 0;
          let f = (t - a.frame) / (b.frame - a.frame);
          if (it === 0 || typeof v(a) !== 'number') value = v(a);
          else {
            if (it === 2 && a.interpolatorId != null && this.ease[a.interpolatorId]) f = this.ease[a.interpolatorId](f);
            value = kp.color ? lerpColor(v(a) ?? 0, v(b) ?? 0, f) : (v(a) ?? 0) + ((v(b) ?? 0) - (v(a) ?? 0)) * f;
          }
        }
        if (value !== undefined) o.p[kp.name] = value;
      }
    }
  }

  // Transforms, opacity, visibility (Solo), skins.
  update() {
    const n = this.c.length, W = new Array(n), op = new Array(n), hidden = new Array(n).fill(false);
    const world = i => {
      if (W[i]) return W[i];
      const o = this.c[i];
      const parentT = this.transformParent(i);
      const pw = parentT == null ? I() : world(parentT);
      let lp = o.p;
      if (o.type === 'Bone') lp = { ...o.p, x: this.c[o.parent].p.length ?? 0, y: 0 };
      W[i] = i === 0 ? I() : o.is.transform ? mul(pw, local(lp)) : pw;
      op[i] = (o.is.transform ? (o.p.opacity ?? 1) : 1) * (parentT == null ? 1 : op[parentT]);
      return W[i];
    };
    for (let i = 0; i < n; i++) world(i);
    // Solo: only the active child (and its subtree) is visible
    const hide = i => { hidden[i] = true; for (const k of this.kids[i]) hide(k); };
    this.c.forEach((o, i) => { if (o.type === 'Solo') for (const k of this.kids[i]) if (k !== (o.p.activeComponentId ?? 0) && this.c[k].is.transform) hide(k); });
    this.W = W; this.op = op; this.hidden = hidden;
    // Skins: bone matrices (slot 0 = identity)
    this.boneMats = {};
    for (const [s, tendons] of Object.entries(this.tendons)) {
      this.boneMats[s] = [I(), ...tendons.map(t => mul(W[this.c[t].p.boneId], inv(fromProps(this.c[t].p))))];
    }
  }
  transformParent(i) { for (let p = this.c[i].parent; p != null; p = this.c[p].parent) { if (this.c[p].is.transform || p === 0) return p; if (p === 0) break; } return null; }

  // World-space points of one vertex: { p, in, out }.
  vertexWorld(v, pathIdx) {
    const o = this.c[v].p, T = this.c[v].type, P = [o.x ?? 0, o.y ?? 0];
    let inn = P, out = P;
    if (T === 'CubicDetachedVertex') { inn = [P[0] + Math.cos(o.inRotation ?? 0) * (o.inDistance ?? 0), P[1] + Math.sin(o.inRotation ?? 0) * (o.inDistance ?? 0)]; out = [P[0] + Math.cos(o.outRotation ?? 0) * (o.outDistance ?? 0), P[1] + Math.sin(o.outRotation ?? 0) * (o.outDistance ?? 0)]; }
    else if (T === 'CubicMirroredVertex') { const d = [Math.cos(o.rotation ?? 0) * (o.distance ?? 0), Math.sin(o.rotation ?? 0) * (o.distance ?? 0)]; inn = [P[0] - d[0], P[1] - d[1]]; out = [P[0] + d[0], P[1] + d[1]]; }
    else if (T === 'CubicAsymmetricVertex') { const c = Math.cos(o.rotation ?? 0), s = Math.sin(o.rotation ?? 0); inn = [P[0] - c * (o.inDistance ?? 0), P[1] - s * (o.inDistance ?? 0)]; out = [P[0] + c * (o.outDistance ?? 0), P[1] + s * (o.outDistance ?? 0)]; }
    const skin = this.skinOf[pathIdx], w = this.weightOf[v];
    if (skin != null && w != null) {
      const bind = fromProps(this.c[skin].p), mats = this.boneMats[skin], wp = this.c[w].p;
      const deform = (pt, indices, values) => {
        const m = [0, 0, 0, 0, 0, 0];
        for (let k = 0; k < 4; k++) {
          const wt = ((values ?? 255) >>> (k * 8)) & 255; if (!wt) continue;
          const M = mats[((indices ?? 1) >>> (k * 8)) & 255] || I();
          for (let j = 0; j < 6; j++) m[j] += M[j] * wt / 255;
        }
        return apply(m, apply(bind, pt));
      };
      return { p: deform(P, wp.indices, wp.values), in: deform(inn, wp.inIndices, wp.inValues), out: deform(out, wp.outIndices, wp.outValues), cubic: T !== 'StraightVertex', radius: o.radius ?? 0 };
    }
    const M = this.W[pathIdx];
    return { p: apply(M, P), in: apply(M, inn), out: apply(M, out), cubic: T !== 'StraightVertex', radius: o.radius ?? 0 };
  }

  // Path commands in world space, following rive Path::buildPath (incl. natural-rounding corners).
  buildPath(pathIdx) {
    const vs = this.verts[pathIdx].map(v => this.vertexWorld(v, pathIdx)), n = vs.length, cmd = [];
    if (n < 2) return cmd;
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], norm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [[v[0] / l, v[1] / l], l]; };
    const add = (p, d, s) => [p[0] + d[0] * s, p[1] + d[1] * s];
    const ideal = (a, b, r) => { const ang = Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1])); return Math.min(r, 4 / 3 * Math.tan(Math.PI / (2 * (2 * Math.PI / ang))) * r * (ang < Math.PI / 2 ? 1 + Math.cos(ang) : 2 - Math.sin(ang))); };
    const corner = (i) => { // returns { enter, c1, c2, exit } for a rounded straight vertex
      const v = vs[i], prev = vs[(i - 1 + n) % n], next = vs[(i + 1) % n];
      const [tp, lp] = norm(sub(prev.cubic ? prev.out : prev.p, v.p)), [tn, ln] = norm(sub(next.cubic ? next.in : next.p, v.p));
      const r = Math.min(lp / 2, ln / 2, Math.abs(v.radius)), d = ideal(tp, tn, r);
      return { enter: add(v.p, tp, r), c1: add(v.p, tp, r - d), c2: add(v.p, tn, r - d), exit: add(v.p, tn, r) };
    };
    let out, prevCubic, start, startIn, startCubic;
    const f = vs[0];
    if (f.cubic) { startCubic = prevCubic = true; startIn = f.in; out = f.out; start = f.p; cmd.push(['M', start]); }
    else if (f.radius) { const k = corner(0); startCubic = prevCubic = false; start = startIn = k.enter; cmd.push(['M', start], ['C', k.c1, k.c2, k.exit]); out = k.exit; }
    else { startCubic = prevCubic = false; start = startIn = out = f.p; cmd.push(['M', out]); }
    for (let i = 1; i < n; i++) {
      const v = vs[i];
      if (v.cubic) { cmd.push(['C', out, v.in, v.p]); prevCubic = true; out = v.out; }
      else if (v.radius) { const k = corner(i); cmd.push(prevCubic ? ['C', out, k.enter, k.enter] : ['L', k.enter]); cmd.push(['C', k.c1, k.c2, k.exit]); out = k.exit; prevCubic = false; }
      else { cmd.push(prevCubic ? ['C', out, v.p, v.p] : ['L', v.p]); out = v.p; prevCubic = false; }
    }
    if (this.c[pathIdx].p.isClosed) { if (prevCubic || startCubic) cmd.push(['C', out, startIn, start]); cmd.push(['Z']); }
    return cmd;
  }

  isHidden(i) { for (let p = i; p != null; p = this.c[p].parent) { if (this.hidden[p]) return true; if (p === 0) break; } return false; }

  // Render to a Canvas2D-like context. `view` = artboard→canvas matrix.
  draw(ctx, view = I()) {
    const toPath = cmds => { const p = new Path2D(); for (const [k, a, b, c] of cmds) { if (k === 'M') p.moveTo(...a); else if (k === 'L') p.lineTo(...a); else if (k === 'C') p.bezierCurveTo(...a, ...b, ...c); else p.closePath(); } return p; };
    const shapePath = s => { const p = new Path2D(); for (const pi of this.paths[s] || []) if (!this.hidden[pi]) p.addPath(toPath(this.buildPath(pi))); return p; };
    // clip source may be a Shape or any Node: every Shape under it contributes (rive ClippingShape::onAddedClean)
    const sourcePath = src => { const p = new Path2D(); const walk = i => { if (this.c[i].type === 'Shape') p.addPath(shapePath(i)); for (const k of this.kids[i]) walk(k); }; walk(src); return p; };
    const colorOf = (argb, alpha) => `rgba(${(argb >>> 16) & 255},${(argb >>> 8) & 255},${argb & 255},${(((argb >>> 24) & 255) / 255) * alpha})`;
    ctx.save();
    for (const s of this.drawables) {
      if (this.isHidden(s)) continue;
      const shape = this.c[s];
      if ((shape.p.drawableFlags ?? 0) & 1) continue; // DrawableFlag::Hidden
      if ((this.op[s] ?? 1) <= 0) continue;
      ctx.save();
      ctx.setTransform(...view);
      // clipping from ancestors
      for (let p = s; p != null; p = this.c[p].parent) { // a ClippingShape clips its parent and everything under it
        for (const cl of this.clips[p] || []) {
          const cp = this.c[cl].p; if (cp.isVisible === false) continue;
          ctx.clip(sourcePath(cp.sourceId), (cp.fillRule ?? 0) === 1 ? 'evenodd' : 'nonzero');
        }
        if (p === 0) break;
      }
      const path = shapePath(s), Ws = this.W[s], scale = Math.sqrt(Math.abs(Ws[0] * Ws[3] - Ws[1] * Ws[2]));
      for (const pi of this.paints[s]) {
        const paint = this.c[pi]; if (paint.p.isVisible === false) continue;
        const mut = this.kids[pi].find(k => /SolidColor|Gradient/.test(this.c[k].type));
        const alpha = this.op[s] ?? 1;
        let style = '#747474';
        if (mut != null) {
          const m = this.c[mut];
          if (m.type === 'SolidColor') style = colorOf(m.p.colorValue ?? 0xFF747474, alpha);
          else {
            const [x0, y0] = apply(Ws, [m.p.startX ?? 0, m.p.startY ?? 0]), [x1, y1] = apply(Ws, [m.p.endX ?? 0, m.p.endY ?? 0]);
            const g = m.type === 'RadialGradient' ? ctx.createRadialGradient(x0, y0, 0, x0, y0, Math.hypot(x1 - x0, y1 - y0)) : ctx.createLinearGradient(x0, y0, x1, y1);
            for (const st of this.stops[mut]) g.addColorStop(Math.min(1, Math.max(0, this.c[st].p.position ?? 0)), colorOf(this.c[st].p.colorValue ?? 0xFFFFFFFF, alpha * (m.p.opacity ?? 1)));
            style = g;
          }
        }
        if (paint.type === 'Fill') { ctx.fillStyle = style; ctx.fill(path, (paint.p.fillRule ?? 0) === 1 ? 'evenodd' : 'nonzero'); }
        else {
          ctx.strokeStyle = style;
          ctx.lineWidth = (paint.p.thickness ?? 1) * (paint.p.transformAffectsStroke === false ? 1 : scale);
          ctx.lineCap = ['butt', 'round', 'square'][paint.p.cap ?? 0];
          ctx.lineJoin = ['miter', 'round', 'bevel'][paint.p.join ?? 0];
          ctx.stroke(path);
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }
}
