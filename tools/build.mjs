// node tools/build.mjs → out/mascot_parts.svg (layered, rig-ready SVG) + check/partmap.svg
//
// 1. Fills: merged trace paths are cut at the joint lines in parts/spec.mjs (paper.js booleans, run in
//    Chromium). Cut pieces overlap their neighbours by SEAM units so no hairline shows at joints.
// 2. Outlines: the trace's single dark silhouette (path 2) is shared out between the parts — every dark
//    pixel goes to the nearest part (raster nearest-part map → traced polygons, grown by a couple of px
//    so neighbouring outline pieces overlap). Each part's outline = silhouette ∩ its territory, minus the
//    fills of parts drawn before it. The outer edges stay the trace's exact curves; the splits sit
//    inside dark bands where they're invisible.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './browser.mjs';
import * as spec from '../parts/spec.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const trace = fs.readFileSync(path.join(ROOT, 'ref/mascot_traced.svg'), 'utf8');
const tracePaths = [...trace.matchAll(/<path d="([^"]+)" fill="([^"]+)"/g)].map(m => ({ d: m[1], fill: m[2] }));
const byIndex = Object.fromEntries(tracePaths.map((p, i) => [i + 2, p])); // = line number in ref/mascot_traced.svg

const browser = await launch();
const page = await browser.newPage();
page.on('console', m => console.log('  [page]', m.text()));
await page.addScriptTag({ path: path.join(ROOT, 'node_modules/paper/dist/paper-core.min.js') });
await page.addScriptTag({ path: path.join(ROOT, 'node_modules/paperjs-offset/dist/paperjs-offset.min.js') });

const result = await page.evaluate(({ byIndex, regions, cutOrder, parts, SILHOUETTE, OUTLINE, SEAM, GROW, BAND, EDGE }) => {
  const W = 1254;
  paper.setup(new paper.Size(W, W));
  const P = d => new paper.CompoundPath({ pathData: d, insert: false });
  const poly = pts => new paper.Path({ segments: pts, closed: true, insert: false });
  const grow = (item, r, n = 8) => { // Minkowski-ish dilation: union of n offset copies
    let g = item.clone({ insert: false });
    for (let k = 0; k < n; k++) {
      const a = k * 2 * Math.PI / n, c = item.clone({ insert: false });
      c.translate(new paper.Point(Math.cos(a) * r, Math.sin(a) * r));
      g = g.unite(c, { insert: false });
    }
    return g;
  };

  // 1. fills
  const pieces = {};
  const add = (part, index, item) => { if (item && !item.isEmpty()) (pieces[part] ||= []).push({ index, item }); };
  for (const [idx, { claims, rest }] of Object.entries(cutOrder)) {
    let remaining = P(byIndex[idx].d);
    for (const part of claims) { // each claim reaches SEAM units past its joint line, under/over its neighbour
      const r = poly(regions[part]);
      add(part, +idx, remaining.intersect(grow(r, SEAM), { insert: false }));
      remaining = remaining.subtract(r, { insert: false });
    }
    add(rest, +idx, remaining);
  }
  for (const p of parts) for (const i of p.paths) add(p.id, i, P(byIndex[i].d));
  const fillsOf = id => (pieces[id] || []).sort((a, b) => a.index - b.index);
  const silOf = {};
  for (const p of parts) {
    const l = fillsOf(p.id); if (!l.length) continue;
    let s = l[0].item.clone({ insert: false });
    for (const { item } of l.slice(1)) s = s.unite(item, { insert: false });
    silOf[p.id] = s;
  }

  // 2. outline territories — nearest-part raster map over the whole canvas
  const owners = parts.filter(p => p.outline && silOf[p.id]);
  const label = new Int16Array(W * W).fill(-1);
  const cv = document.createElement('canvas'); cv.width = cv.height = W;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  owners.forEach((p, k) => {
    ctx.clearRect(0, 0, W, W); ctx.fill(new Path2D(silOf[p.id].pathData));
    const a = ctx.getImageData(0, 0, W, W).data;
    for (let i = 0; i < W * W; i++) if (a[i * 4 + 3] >= 128) label[i] = k; // later (front) parts win overlaps
  });
  // A dark pixel lying BETWEEN two parts (d1 + d2 ≤ BAND) goes to the front one of the pair, so moving a front
  // part never leaves a half-band stripe on the part behind (which gets a hidden ring instead). Anything else
  // (outer silhouette, creases inside one part) goes to its nearest part.
  const fillLabel = label.slice();
  ctx.clearRect(0, 0, W, W); ctx.fill(new Path2D(SILHOUETTE));
  const sa = ctx.getImageData(0, 0, W, W).data;
  const dark = new Uint8Array(W * W); for (let i = 0; i < W * W; i++) dark[i] = sa[i * 4 + 3] >= 128 && fillLabel[i] < 0;
  const MAXD = 60, dist = owners.map((_, k) => { // distance through visible dark, alternating 8/4-conn ≈ Euclidean
    const d = new Uint8Array(W * W).fill(255);
    let frontier = []; for (let i = 0; i < W * W; i++) if (fillLabel[i] === k) { d[i] = 0; frontier.push(i); }
    for (let step = 1; step <= MAXD && frontier.length; step++) {
      const next = [], diag = step % 2 === 1;
      for (const i of frontier) {
        const x = i % W, y = (i / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || (!diag && dx && dy)) continue;
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
          const j = ny * W + nx; if (dark[j] && d[j] === 255) { d[j] = step; next.push(j); }
        }
      }
      frontier = next;
    }
    return d;
  });
  for (let i = 0; i < W * W; i++) {
    if (!dark[i]) continue;
    let b = -1, s = -1;
    for (let k = 0; k < owners.length; k++) {
      const v = dist[k][i]; if (v === 255) continue;
      if (b < 0 || v < dist[b][i] || (v === dist[b][i] && k > b)) { s = b; b = k; }
      else if (s < 0 || v < dist[s][i]) s = k;
    }
    if (b < 0) continue;
    // the front part takes the band only within its own ring width (so its piece stays inside its smooth ring)
    label[i] = s > b && dist[b][i] + dist[s][i] <= BAND && (!owners[s].ring || dist[s][i] <= owners[s].ring - 5) ? s : b;
  }
  // At a cut joint the outline is split along the joint line, not by nearest part: dark pixels inside a claim's
  // region that went to the cut's `rest` part (torso / head) go to the claim, so swapping a limb or ear for a
  // variant never leaves torso/head outline slivers lying over it.
  const idx = id => owners.findIndex(o => o.id === id);
  for (const { claims, rest } of Object.values(cutOrder)) {
    const r = idx(rest); if (r < 0) continue;
    for (const c of claims) {
      const k = idx(c); if (k < 0) continue;
      ctx.clearRect(0, 0, W, W); ctx.fill(new Path2D('M' + regions[c].map(p => p.join(' ')).join('L') + 'Z'));
      const a = ctx.getImageData(0, 0, W, W).data;
      for (let i = 0; i < W * W; i++) if (dark[i] && label[i] === r && a[i * 4 + 3] >= 128) label[i] = k;
    }
  }
  let queue = []; for (let i = 0; i < W * W; i++) if (label[i] >= 0) queue.push(i);
  while (queue.length) { // the rest (deep dark + background): 8-connected BFS = chessboard-distance Voronoi
    const next = [];
    for (const i of queue) {
      const x = i % W, y = (i / W) | 0, l = label[i];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
        const j = ny * W + nx; if (label[j] < 0) { label[j] = l; next.push(j); }
      }
    }
    queue = next;
  }
  // Staircase → smooth: two capped corner-cutting passes then Douglas–Peucker (0.5 px). Split lines between outline pieces are
  // then smooth curves, so a piece's edge never looks jagged when its neighbour moves away. Deviation < 1 px, well
  // inside the GROW overlap, so the rest pose is unaffected.
  const dp = (pts, eps) => {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]]; let iMax = 0, dMax = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L;
      if (d > dMax) { dMax = d; iMax = i; }
    }
    return dMax > eps ? [...dp(pts.slice(0, iMax + 1), eps).slice(0, -1), ...dp(pts.slice(iMax), eps)] : [a, b];
  };
  const SMOOTH = true;
  const smooth = loop => {
    let pts = loop; // corner-cutting with each cut capped at 1 px (plain Chaikin cuts 25 % of long runs), then DP
    for (let it = 0; it < 2; it++) pts = pts.flatMap((p, i) => {
      const q = pts[(i + 1) % pts.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, t = Math.min(0.25, 1 / L);
      return [[p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], [q[0] - (q[0] - p[0]) * t, q[1] - (q[1] - p[1]) * t]];
    });
    const half = pts.length >> 1; // DP on a closed loop: split in two open halves
    return [...dp(pts.slice(0, half + 1), 0.5).slice(0, -1), ...dp([...pts.slice(half), pts[0]], 0.5).slice(0, -1)];
  };
  const traceMask = m => { // pixel-edge loops, clockwise in y-down space
    const V = W + 1, out = new Map(), at = (x, y) => x >= 0 && y >= 0 && x < W && y < W && m[y * W + x];
    const e = (x1, y1, x2, y2) => { const k = y1 * V + x1; (out.get(k) || out.set(k, []).get(k)).push(y2 * V + x2); };
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) {
      if (!at(x, y - 1)) e(x, y, x + 1, y); if (!at(x + 1, y)) e(x + 1, y, x + 1, y + 1);
      if (!at(x, y + 1)) e(x + 1, y + 1, x, y + 1); if (!at(x - 1, y)) e(x, y + 1, x, y);
    }
    const loops = [];
    for (const start of [...out.keys()]) {
      while (out.get(start).length) {
        const pts = []; let v = start;
        do { pts.push([v % V, (v / V) | 0]); const l = out.get(v); if (!l || !l.length) break; v = l.pop(); } while (v !== start);
        const c = pts.filter((p, i) => { const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length]; return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1])); });
        if (c.length >= 4) loops.push(SMOOTH ? smooth(c) : c);
      }
    }
    return loops;
  };
  const silhouette = P(SILHOUETTE);
  const outlineOf = {}, outlineItem = {};
  owners.forEach((p, k) => {
    const m = new Uint8Array(W * W);
    for (let i = 0; i < W * W; i++) if (label[i] === k) { // grow GROW px over parts BEHIND only: front covers the
      const x = i % W, y = (i / W) | 0;                     // seam, and nothing is left behind when it moves away
      for (let dy = -GROW; dy <= GROW; dy++) for (let dx = -GROW; dx <= GROW; dx++) {
        const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < W && label[ny * W + nx] <= k) m[ny * W + nx] = 1;
      }
    }
    const terr = new paper.CompoundPath({ insert: false, children: traceMask(m).map(l => poly(l)), fillRule: 'nonzero' });
    let o = silhouette.intersect(terr, { insert: false });
    const myZ = parts.findIndex(q => q.id === p.id);
    for (const q of parts.slice(0, myZ)) if (silOf[q.id] && silOf[q.id].bounds.intersects(o.bounds)) o = o.subtract(silOf[q.id], { insert: false });
    outlineOf[p.id] = o.pathData; outlineItem[p.id] = o;
  });

  // 3. hidden art + outline-completion rings, both clipped to where they can't show in the rest pose
  const R = poly([[-60, -60], [W + 60, -60], [W + 60, W + 60], [-60, W + 60]]);
  const erode = (a, r, n = 8) => a.subtract(grow(R.subtract(a, { insert: false }), r, n), { insert: false });
  // ring outer shape: a true round-join offset (paperjs-offset) — fills narrow notches naturally, no echoed dents
  // or sliver cracks; falls back to the 16-copy dilation if the offset fails on a shape
  const ringOuter = (a, t) => {
    try { const o = a.offset(t, { join: 'round', insert: false }); if (o && !o.isEmpty() && o.area > a.area) return o.unite(a, { insert: false }); } catch (e) { console.log('offset fallback', e.message); }
    return grow(a, t, 16);
  };
  const uni = list => list.filter(Boolean).reduce((a, b) => a ? a.unite(b, { insert: false }) : b.clone({ insert: false }), null);
  const allFills = uni(Object.values(silOf));
  const darkRest = silhouette.subtract(allFills, { insert: false });   // the dark you can see in the rest pose
  const coverOf = {}; let cover = null;                                 // everything drawn in front of a part
  const fillCoverOf = {}; let fillCover = null;                        // same, fills only (smooth edges)
  for (const p of [...parts].reverse()) {
    coverOf[p.id] = cover; cover = uni([cover, silOf[p.id], outlineItem[p.id]]);
    fillCoverOf[p.id] = fillCover; fillCover = uni([fillCover, silOf[p.id]]);
  }
  // outer contours only (a hairline gap between fill pieces must not become a dark hole in a ring)
  const noHoles = a => {
    if (!a.children) return a;
    const kids = a.children.filter(c => Math.sign(c.area) === Math.sign([...a.children].sort((x, y) => Math.abs(y.area) - Math.abs(x.area))[0].area));
    return new paper.CompoundPath({ insert: false, children: kids.map(c => c.clone({ insert: false })) });
  };
  // Standalone outline for parts that get mirrored into variants (and for mirrored hidden copies): a smooth full
  // ring around the real fills, open on the joint side (`variantSource.open`), + the original piece's inner details
  // (claws, creases) — but none of the band bits that belong to the part's surroundings in the rest pose.
  const soloOf = {}, soloItem = {};
  for (const p of parts.filter(p => p.variantSource && silOf[p.id])) {
    const base = noHoles(silOf[p.id]);
    let ring = ringOuter(base, p.ring).subtract(base, { insert: false });
    if (p.variantSource.open) ring = ring.subtract(poly(p.variantSource.open), { insert: false });
    const inner = outlineItem[p.id] ? outlineItem[p.id].intersect(grow(base, p.ring - 8, 16), { insert: false }) : null;
    const innerT = inner && p.variantSource.trim ? inner.subtract(poly(p.variantSource.trim), { insert: false }) : inner;
    soloItem[p.id] = uni([ring, innerT]); soloOf[p.id] = soloItem[p.id].pathData;
  }
  const hiddenOf = {}, ringOf = {};
  for (const p of parts) {
    const front = coverOf[p.id];
    if (p.hidden && front) {
      const clip = erode(grow(uni([front, outlineItem[p.id], silOf[p.id]]), 1.5), 1.5 + EDGE); // closing seals stitch gaps
      // { d, fill } = a new shape (extends the part's ring); { from, mirror } = another part's outline + fills,
      // mirrored about x = mirror (brings its own outline, so it doesn't extend the ring)
      const items = p.hidden.flatMap(h => h.from
        ? [{ fill: OUTLINE, item: soloItem[h.from] || outlineItem[h.from] }, ...fillsOf(h.from).map(f => ({ fill: byIndex[f.index].fill, item: f.item }))]
            .filter(x => x.item).map(x => { const c = x.item.clone({ insert: false }); c.scale(-1, 1, new paper.Point(h.mirror, 0)); return { fill: x.fill, item: c, copy: true }; })
        : [{ fill: h.fill, item: P(h.d) }]);
      hiddenOf[p.id] = items.map(h => ({ ...h, item: h.item.intersect(clip, { insert: false }) })).filter(h => !h.item.isEmpty());
    }
    if (p.ring && silOf[p.id]) {
      const base = noHoles(uni([silOf[p.id], ...(hiddenOf[p.id] || []).filter(h => !h.copy).map(h => h.item)]));
      const safe = erode(uni([darkRest, fillCoverOf[p.id]]), EDGE); // outline pieces are inside darkRest already
      const ring = ringOuter(base, p.ring).subtract(base, { insert: false }).intersect(safe, { insert: false });
      if (!ring.isEmpty()) ringOf[p.id] = ring.pathData;
    }
  }

  return parts.map(p => ({
    id: p.id, outline: outlineOf[p.id] || null, ring: ringOf[p.id] || null, solo: soloOf[p.id] || null,
    hidden: (hiddenOf[p.id] || []).map(h => ({ fill: h.fill, d: h.item.pathData })),
    fills: fillsOf(p.id).map(({ index, item }) => ({ index, fill: byIndex[index].fill, d: item.pathData })),
  }));
}, { byIndex, regions: spec.regions, cutOrder: spec.cutOrder, parts: spec.parts, SILHOUETTE: byIndex[2].d, OUTLINE: spec.OUTLINE, SEAM: 1.2, GROW: 3, BAND: 36, EDGE: 0.7 });
await browser.close();

const r2 = d => d.replace(/-?\d*\.\d+/g, n => String(+(+n).toFixed(2)));
const svg = [`<svg width="1254" height="1254" viewBox="0 0 1254 1254" fill="none" xmlns="http://www.w3.org/2000/svg">`];
for (const p of result) {
  svg.push(`<g id="${p.id}">`);
  if (p.ring) svg.push(`<path id="${p.id}__ring" d="${r2(p.ring)}" fill="${spec.OUTLINE}"/>`);
  p.hidden.forEach((h, i) => svg.push(`<path id="${p.id}__hidden${i}" d="${r2(h.d)}" fill="${h.fill}"/>`));
  if (p.outline) svg.push(`<path id="${p.id}__outline" d="${r2(p.outline)}" fill="${spec.OUTLINE}"/>`);
  svg.push(...p.fills.map(f => `<path data-src="${f.index}" d="${r2(f.d)}" fill="${f.fill}"/>`));
  svg.push(`</g>`);
}
svg.push('</svg>');
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out/mascot_parts.svg'), svg.join('\n'));
// out/mascot_solo.svg: variant sources with their standalone outline (read by tools/variants.mjs)
fs.writeFileSync(path.join(ROOT, 'out/mascot_solo.svg'), [svg[0], ...result.filter(p => p.solo).map(p =>
  `<g id="${p.id}"><path id="${p.id}__outline" d="${r2(p.solo)}" fill="${spec.OUTLINE}"/>${p.hidden.filter(h => h.fill !== spec.OUTLINE).map((h, i) => `<path id="${p.id}__hidden${i}" d="${r2(h.d)}" fill="${h.fill}"/>`).join('')}${p.fills.map(f => `<path data-src="${f.index}" d="${r2(f.d)}" fill="${f.fill}"/>`).join('')}</g>`), '</svg>'].join('\n'));

// part map: each part's outline + fills in one flat colour (outline darker) to eyeball the split
const map = [`<svg width="1254" height="1254" viewBox="0 0 1254 1254" fill="none" xmlns="http://www.w3.org/2000/svg">`];
result.forEach((p, i) => {
  const h = (i * 137.5) % 360;
  if (p.outline) map.push(`<path d="${r2(p.outline)}" fill="hsl(${h} 60% 35%)"/>`);
  map.push(...p.fills.map(f => `<path d="${r2(f.d)}" fill="hsl(${h} 70% 65%)"/>`));
});
map.push('</svg>');
fs.mkdirSync(path.join(ROOT, 'check'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'check/partmap.svg'), map.join('\n'));
console.log(result.map(p => `${p.id}: ${p.fills.length} fills${p.outline ? ' + outline' : ''}`).join(' · '));
