// node tools/vectorize.mjs <image.png> <out.json>
// Image-trace a flat cartoon into layered vector shapes in the user's exact palette (like their own Figma vectorize):
//   1. snap every pixel to the nearest palette colour (generated images drift in colour),
//   2. clean anti-aliasing noise with a 5×5 majority filter,
//   3. trace each colour region (pixel loops) and fit low-vertex cubic curves (paper.js simplify, seam-safe),
//   4. layer order: dark silhouette (= union of everything) first, then each colour region on top.
// Also reports metrics used to align the result with the original art (medal centre, torso width).
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './browser.mjs';

const [, , src, out] = process.argv;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PALETTE = { // user's palette (from the original art)
  bg: '#FFFFFF', ink: '#260554', skin: '#D58CF4', shade: '#B772E9', shadow: '#E6DBFB',
  capeDk: '#C31A23', cape: '#FB282B', capeMid: '#E62329', gold: '#FECD31', goldDk: '#F39810',
};
const browser = await launch();
const page = await browser.newPage();
page.on('console', m => console.log('  [page]', m.text()));
await page.addScriptTag({ path: path.join(ROOT, 'node_modules/paper/dist/paper-core.min.js') });
const res = await page.evaluate(async ({ data, PALETTE }) => {
  const img = new Image(); await new Promise(r => { img.onload = r; img.src = data; });
  const W = img.width, H = img.height;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
  const px = cx.getImageData(0, 0, W, H).data;
  const names = Object.keys(PALETTE), cols = names.map(n => { const h = PALETTE[n]; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; });
  // 1. nearest palette colour (generated off-shades: lighter lilacs → skin, darker → shade)
  let cls = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2]; let best = 0, bd = 1e9;
    for (let k = 0; k < cols.length; k++) { const c = cols[k], d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2; if (d < bd) { bd = d; best = k; } }
    cls[i] = best;
  }
  // 2. 5×5 majority filter (twice) — removes anti-aliasing fringes between regions
  const N = names.length;
  for (let pass = 0; pass < 2; pass++) {
    const nxt = new Uint8Array(W * H), cnt = new Uint16Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      cnt.fill(0);
      for (let dy = -2; dy <= 2; dy++) { const yy = Math.min(H - 1, Math.max(0, y + dy)); for (let dx = -2; dx <= 2; dx++) { const xx = Math.min(W - 1, Math.max(0, x + dx)); cnt[cls[yy * W + xx]]++; } }
      let best = cls[y * W + x], bn = 0; for (let k = 0; k < N; k++) if (cnt[k] > bn) { bn = cnt[k]; best = k; }
      nxt[y * W + x] = best;
    }
    cls = nxt;
  }
  // 3. trace
  paper.setup(new paper.Size(W, H));
  const traceLoops = m => {
    const V = W + 1, outE = new Map(), at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x];
    const e = (x1, y1, x2, y2) => { const k = y1 * V + x1; (outE.get(k) || outE.set(k, []).get(k)).push(y2 * V + x2); };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) {
      if (!at(x, y - 1)) e(x, y, x + 1, y); if (!at(x + 1, y)) e(x + 1, y, x + 1, y + 1);
      if (!at(x, y + 1)) e(x + 1, y + 1, x, y + 1); if (!at(x - 1, y)) e(x, y + 1, x, y);
    }
    const loops = [];
    for (const s of [...outE.keys()]) while (outE.get(s).length) {
      const pts = []; let v = s;
      do { pts.push([v % V, (v / V) | 0]); const l = outE.get(v); if (!l || !l.length) break; v = l.pop(); } while (v !== s);
      if (pts.length >= 8) loops.push(pts);
    }
    return loops;
  };
  const fitLoop = pts => { // seam-safe fit: open at the first point, simplify, close
    const f = new paper.Path({ segments: pts, closed: true, insert: false });
    const area = f.area; if (Math.abs(area) < 40) return null;
    const o = new paper.Path({ segments: [...f.segments.map(s => s.point), f.firstSegment.point], closed: false, insert: false });
    o.simplify(Math.min(2.2, Math.max(0.6, Math.sqrt(Math.abs(area)) / 40)));
    const hin = o.lastSegment.handleIn.clone(); o.lastSegment.remove(); o.closed = true; o.firstSegment.handleIn = hin;
    return o.segments.map(s => ({ x: +s.point.x.toFixed(2), y: +s.point.y.toFixed(2), in: [+(s.point.x + s.handleIn.x).toFixed(2), +(s.point.y + s.handleIn.y).toFixed(2)], out: [+(s.point.x + s.handleOut.x).toFixed(2), +(s.point.y + s.handleOut.y).toFixed(2)] }));
  };
  const layers = [];
  const bgK = names.indexOf('bg'), inkK = names.indexOf('ink'), shK = names.indexOf('shadow');
  const sil = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) sil[i] = cls[i] !== bgK && cls[i] !== shK ? 1 : 0;
  layers.push({ name: 'silhouette', color: PALETTE.ink, contours: traceLoops(sil).map(fitLoop).filter(Boolean) });
  for (let k = 0; k < N; k++) {
    if (k === bgK || k === inkK) continue;
    const m = new Uint8Array(W * H); let n = 0; for (let i = 0; i < W * H; i++) if (cls[i] === k) { m[i] = 1; n++; }
    if (n < 50) continue;
    layers.push({ name: names[k], color: PALETTE[names[k]], contours: traceLoops(m).map(fitLoop).filter(Boolean) });
  }
  // metrics: medal centre (gold centroid), torso row extents
  let gx = 0, gy = 0, gn = 0; const goldK = names.indexOf('gold'), goldDkK = names.indexOf('goldDk');
  for (let i = 0; i < W * H; i++) if (cls[i] === goldK || cls[i] === goldDkK) { gx += i % W; gy += (i / W) | 0; gn++; }
  const rowExtent = y => { let a = -1, b = -1; const skinK = names.indexOf('skin'), shadeK = names.indexOf('shade'); for (let x = 0; x < W; x++) { const c = cls[y * W + x]; if (c === skinK || c === shadeK || c === inkK) { if (a < 0) a = x; b = x; } } return [a, b]; };
  return { W, H, layers, medal: gn ? [gx / gn, gy / gn] : null, rowExtent: Object.fromEntries([0.70, 0.75, 0.80].map(f => { const y = Math.round(H * f); return [y, rowExtent(y)]; })) };
}, { data: 'data:image/png;base64,' + fs.readFileSync(src).toString('base64'), PALETTE });
await browser.close();
fs.writeFileSync(out, JSON.stringify(res));
console.log(`${res.W}×${res.H} · medal ${res.medal?.map(v => v.toFixed(1))} · ` + res.layers.map(l => `${l.name}:${l.contours.length}`).join(' ') + ' · rows ' + JSON.stringify(res.rowExtent));
