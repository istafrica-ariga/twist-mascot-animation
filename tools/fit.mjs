// node tools/fit.mjs [tolerance=1.2] → rig/parts.json
// Turns each traced part (out/mascot_parts.svg) into clean, low-vertex vector shapes, Rive-style:
//   base    – the part's silhouette (notches sealed), fitted cubic path: drawn with stroke (outline) + fill
//   details – highlight / shading regions inside the part, fitted, fill only
//   slits   – the sealed notches (claw lines, creases) as small dark shapes
// Curve fitting = paper.js Path.simplify (Schneider's algorithm). Output vertices are absolute { x, y, in, out }.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './browser.mjs';
import { OUTLINE, parts as SPEC } from '../parts/spec.mjs';

const TOL = +(process.argv[2] || 1.2);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const svg = fs.readFileSync(path.join(ROOT, 'out/mascot_parts.svg'), 'utf8');
const groups = {};
for (const m of svg.matchAll(/<g id="([a-zA-Z_]+)">([\s\S]*?)<\/g>/g)) {
  groups[m[1]] = [...m[2].matchAll(/<path data-src="(\d+)" d="([^"]+)" fill="([^"]+)"\/>/g)].map(x => ({ src: +x[1], d: x[2], fill: x[3] }));
}
const outlined = Object.fromEntries(SPEC.map(p => [p.id, !!p.outline]));
// swap-in variants (out/mascot_variants.svg): mouths, fitted as plain layers (keeping any stroke)
const variantsSvg = fs.existsSync(path.join(ROOT, 'out/mascot_variants.svg')) ? fs.readFileSync(path.join(ROOT, 'out/mascot_variants.svg'), 'utf8') : '';
for (const id of ['mouth_mid', 'mouth_closed']) {
  const m = variantsSvg.match(new RegExp(`<g id="${id}">([\\s\\S]*?)</g>`)); if (!m) continue;
  groups[id] = [...m[1].matchAll(/<path([^>]*?) d="([^"]+)"([^>]*)\/>/g)].map((x, i) => {
    const attrs = x[1] + x[3], fill = (attrs.match(/fill="([^"]+)"/) || [])[1], sw = (attrs.match(/stroke-width="([^"]+)"/) || [])[1];
    return { src: 1000 + i, d: x[2], fill, stroke: sw ? +sw : 0 };
  });
  outlined[id] = false;
}
// Merged silhouettes (like the user's Rive rig, where body + arms + legs are ONE skinned path):
// the member parts' fills become one part; internal lines turn into dark slit shapes.
const MERGE = { body: ['leg_L', 'leg_R', 'torso', 'arm_R_upper', 'hand_R'], armL: ['arm_L', 'hand_L'] };
const SEAL = { body: 7, armL: 7 };
// Seam patches: fill-only copies of the original pieces around a joint whose root edge would otherwise show an
// outline (the raised arm is its own stroked shape on top of the body). Region = disc ∩ (body shrunk by `inset`),
// so the patch never covers a silhouette outline.
const PATCH = { armL_patch: { over: 'armL', under: 'body', center: [495, 590], radius: 46, inset: 21 } };
const patchSources = {};
for (const [name, pt] of Object.entries(PATCH)) patchSources[name] = { ...pt, fills: [...(groups[pt.under] ? [] : []), ...MERGE[pt.over].flatMap(m => groups[m] || []), ...MERGE[pt.under].flatMap(m => groups[m] || [])] };
for (const [name, members] of Object.entries(MERGE)) {
  groups[name] = members.flatMap(m => (groups[m] || []).map(f => ({ ...f, member: m })));
  outlined[name] = true;
  for (const m of members) delete groups[m];
}

const browser = await launch();
const page = await browser.newPage();
page.on('console', m => console.log('  [page]', m.text()));
await page.addScriptTag({ path: path.join(ROOT, 'node_modules/paper/dist/paper-core.min.js') });
await page.addScriptTag({ path: path.join(ROOT, 'node_modules/paperjs-offset/dist/paperjs-offset.min.js') });
const out = await page.evaluate(({ groups, outlined, TOL, OUTLINE, SEAL, patchSources }) => {
  paper.setup(new paper.Size(1254, 1254));
  const P = d => new paper.CompoundPath({ pathData: d, insert: false });
  const uni = list => list.reduce((a, b) => a ? a.unite(b, { insert: false }) : b.clone({ insert: false }), null);
  const offset = (a, r) => { try { const o = a.offset(r, { join: 'round', insert: false }); return o && !o.isEmpty() ? o : a; } catch (e) { return a; } };
  const area = a => Math.abs(a.area);
  // Morphological closing on a 2× raster (chamfer distance transform), returning only the NEW pixels (notches)
  // as traced polygons. Vector offsets proved unreliable for negative distances on these shapes.
  const Z = 2, W = 1254 * Z;
  const cv = document.createElement('canvas'); cv.width = cv.height = W;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const chamfer = (inside) => { // distance (in px) from each pixel to the nearest pixel where inside==0
    const d = new Float32Array(W * W);
    for (let i = 0; i < W * W; i++) d[i] = inside[i] ? 1e9 : 0;
    const a = 1, bb = Math.SQRT2;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!d[i]) continue; let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + a); if (y > 0) { v = Math.min(v, d[i - W] + a); if (x > 0) v = Math.min(v, d[i - W - 1] + bb); if (x < W - 1) v = Math.min(v, d[i - W + 1] + bb); } d[i] = v; }
    for (let y = W - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!d[i]) continue; let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + a); if (y < W - 1) { v = Math.min(v, d[i + W] + a); if (x < W - 1) v = Math.min(v, d[i + W + 1] + bb); if (x > 0) v = Math.min(v, d[i + W - 1] + bb); } d[i] = v; }
    return d;
  };
  const traceLoops = m => {
    const V = W + 1, out = new Map(), at = (x, y) => x >= 0 && y >= 0 && x < W && y < W && m[y * W + x];
    const e = (x1, y1, x2, y2) => { const k = y1 * V + x1; (out.get(k) || out.set(k, []).get(k)).push(y2 * V + x2); };
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) {
      if (!at(x, y - 1)) e(x, y, x + 1, y); if (!at(x + 1, y)) e(x + 1, y, x + 1, y + 1);
      if (!at(x, y + 1)) e(x + 1, y + 1, x, y + 1); if (!at(x - 1, y)) e(x, y + 1, x, y);
    }
    const loops = [];
    for (const start of [...out.keys()]) while (out.get(start).length) {
      const pts = []; let v = start;
      do { pts.push([(v % V) / Z, ((v / V) | 0) / Z]); const l = out.get(v); if (!l || !l.length) break; v = l.pop(); } while (v !== start);
      if (pts.length >= 4) loops.push(pts);
    }
    return loops;
  };
  const notches = (item, r) => {
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, W, W); cx.setTransform(Z, 0, 0, Z, 0, 0);
    cx.fill(new Path2D(item.pathData));
    const a = cx.getImageData(0, 0, W, W).data, mask = new Uint8Array(W * W);
    for (let i = 0; i < W * W; i++) mask[i] = a[i * 4 + 3] >= 128 ? 1 : 0;
    const R = r * Z;
    const dOut = chamfer(mask.map(v => 1 - v));          // distance to the shape
    const dil = new Uint8Array(W * W); for (let i = 0; i < W * W; i++) dil[i] = dOut[i] <= R ? 1 : 0;
    const dIn = chamfer(dil);                              // distance to outside of the dilated shape
    const notch = new Uint8Array(W * W); for (let i = 0; i < W * W; i++) notch[i] = dIn[i] > R && !mask[i] ? 1 : 0;
    const loops = traceLoops(notch).map(l => new paper.Path({ segments: l, closed: true, insert: false }));
    return loops.length ? new paper.CompoundPath({ children: loops, insert: false, fillRule: 'nonzero' }) : null;
  };
  // fitted outer contours → [{ vertices }]
  const fit = item => {
    const kids = (item.children ? [...item.children] : [item]).filter(k => Math.abs(k.area) > 4);
    return kids.map(k => {
      const sz = Math.max(k.bounds.width, k.bounds.height);
      // paper's simplify mishandles the closing seam of closed paths (−3 % area on a circle): cut open at the first
      // point, simplify as an open curve, close again carrying the seam's incoming handle. Refit tighter if the
      // area still drifts > 1 %.
      const fitOnce = tol => {
        const f = k.clone({ insert: false }); f.flatten(Math.min(0.6, sz / 60));
        const o = new paper.Path({ segments: [...f.segments.map(s => s.point), f.firstSegment.point], closed: false, insert: false });
        o.simplify(tol);
        const hin = o.lastSegment.handleIn.clone(); o.lastSegment.remove(); o.closed = true; o.firstSegment.handleIn = hin;
        return o;
      };
      let tol = Math.min(TOL, Math.max(0.15, sz / 80)), c = fitOnce(tol);              // small shapes keep detail
      for (let i = 0; i < 3 && Math.abs(Math.abs(c.area) - Math.abs(k.area)) > 0.01 * Math.abs(k.area); i++) c = fitOnce(tol /= 2);
      if (Math.sign(c.area) !== Math.sign(k.area)) c.reverse();
      return { hole: c.clockwise !== kids[0].clockwise && kids.length > 1 && Math.abs(c.area) < Math.abs(kids[0].area), vertices: c.segments.map(s => ({
        x: +s.point.x.toFixed(2), y: +s.point.y.toFixed(2),
        in: [+(s.point.x + s.handleIn.x).toFixed(2), +(s.point.y + s.handleIn.y).toFixed(2)],
        out: [+(s.point.x + s.handleOut.x).toFixed(2), +(s.point.y + s.handleOut.y).toFixed(2)] })) };
    });
  };
  const res = {};
  for (const [id, fills] of Object.entries(groups)) {
    if (!fills.length) continue;
    const items = fills.map(f => ({ ...f, item: P(f.d) }));
    // base colour = the colour covering the most area
    const byColor = {};
    for (const f of items) byColor[f.fill] = (byColor[f.fill] || 0) + area(f.item);
    const base = Object.entries(byColor).sort((a, b) => b[1] - a[1])[0][0];
    const union = uni(items.map(f => f.item));
    const nt = outlined[id] ? notches(union, SEAL[id] ?? 4) : null;            // notches narrower than 2r
    const sealed = nt ? union.unite(nt, { insert: false }) : union;
    const slits = nt;
    const slitParts = slits ? (slits.children ? [...slits.children] : [slits]).filter(k => Math.abs(k.area) > 6) : [];
    res[id] = {
      __sealed: sealed.pathData,
      base: { color: base, contours: fit(sealed) },
      details: items.filter(f => f.fill !== base && f.fill !== OUTLINE).map(f => ({ color: f.fill, src: f.src, contours: fit(f.item) })),
      darks: items.filter(f => f.fill === OUTLINE).map(f => ({ color: f.fill, src: f.src, contours: fit(f.item) })),
      slits: slitParts.map(k => ({ color: OUTLINE, contours: fit(k) })),
      layers: items.map(f => ({ color: f.fill, src: f.src, stroke: f.stroke || 0, contours: fit(f.item) })), // every fill, trace order
    };
  }
  // seam patches (raster region → traced → each source piece clipped to it)
  for (const [name, pt] of Object.entries(patchSources)) {
    const under = uni(groups[pt.under] ? [] : []) ;
    const body = uni(pt.fills.filter((f, i) => i >= 0).map(f => P(f.d)));
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, W, W); cx.setTransform(Z, 0, 0, Z, 0, 0);
    cx.fill(new Path2D(res[pt.under].__sealed));
    const a = cx.getImageData(0, 0, W, W).data, m = new Uint8Array(W * W);
    for (let i = 0; i < W * W; i++) m[i] = a[i * 4 + 3] >= 128 ? 1 : 0;
    const dIn = chamfer(m), reg = new Uint8Array(W * W);
    const [cxp, cyp] = pt.center;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const i = y * W + x; reg[i] = dIn[i] > pt.inset * Z && Math.hypot(x / Z - cxp, y / Z - cyp) < pt.radius ? 1 : 0; }
    const loops = traceLoops(reg).map(l => new paper.Path({ segments: l, closed: true, insert: false }));
    const region = new paper.CompoundPath({ children: loops, insert: false });
    res[name] = { base: null, details: [], darks: [], slits: [], layers: pt.fills.map(f => ({ color: f.fill, contours: fit(P(f.d).intersect(region, { insert: false })) })).filter(l => l.contours.length) };
  }
  for (const k in res) delete res[k].__sealed;
  return res;
}, { groups, outlined, TOL, OUTLINE, SEAL, patchSources });
await browser.close();
fs.mkdirSync(path.join(ROOT, 'rig'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'rig/parts.json'), JSON.stringify(out));
let total = 0;
for (const [id, p] of Object.entries(out)) {
  const n = [p.base, ...p.details, ...p.darks, ...p.slits, ...(p.base ? [] : p.layers)].filter(Boolean).flatMap(s => s.contours).reduce((a, c) => a + c.vertices.length, 0);
  total += n;
  console.log(`${id.padEnd(14)} base ${p.base ? p.base.contours.map(c => c.vertices.length).join('+') : '-'} vtx · ${p.details.length} details · ${p.darks.length} darks · ${p.slits.length} slits · ${n} vertices`);
}
console.log(`total ${total} vertices (tolerance ${TOL})`);
