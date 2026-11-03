// node rig3/compose.mjs [scale] [cutY]
// Stand pose composite: generated stand body (traced, palette-snapped) + the user's EXACT head/face/collar/medal parts.
//   1. mask the generated crop above the cape line (cutY, crop px) so only the body is traced,
//   2. vectorize it, map into the 1254 rig space so its medal lands on the original medal (628, 594),
//   3. overlay the original groups from out/mascot_parts.svg (+ mouth_closed from out/mascot_variants.svg).
// → rig3/stand_body.json (rig-space contours) + rig3/stand_composite.svg/.png
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch, renderSvg } from '../tools/browser.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const S = +(process.argv[2] ?? 0.66), CUT = +(process.argv[3] ?? 640);
const MEDAL_SRC = [500.7, 746.3], MEDAL_DST = [628, 594];
const src = path.join(ROOT, 'poses/stand/edit0_crop.png'), masked = path.join(ROOT, 'rig3/.stand_masked.png'), vec = path.join(ROOT, 'rig3/.stand_vec.json');

const browser = await launch();
const page = await browser.newPage();
const png = await page.evaluate(async ({ data, CUT }) => {
  const img = new Image(); await new Promise(r => { img.onload = r; img.src = data; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d');
  x.drawImage(img, 0, 0); x.fillStyle = '#fff'; x.fillRect(0, 0, img.width, CUT);
  return c.toDataURL('image/png');
}, { data: 'data:image/png;base64,' + fs.readFileSync(src).toString('base64'), CUT });
fs.writeFileSync(masked, Buffer.from(png.split(',')[1], 'base64'));
execFileSync('node', [path.join(ROOT, 'tools/vectorize.mjs'), masked, vec], { stdio: 'inherit' });

const v = JSON.parse(fs.readFileSync(vec, 'utf8'));
const T = ([x, y]) => [+(MEDAL_DST[0] + (x - MEDAL_SRC[0]) * S).toFixed(2), +(MEDAL_DST[1] + (y - MEDAL_SRC[1]) * S).toFixed(2)];
// drop the traced medal (the original medal goes on top) and the floor shadow (the rig has its own)
const layers = v.layers.filter(l => l.name !== 'shadow').map(l => ({ name: l.name, color: l.color, contours: l.contours.map(c => c.map(p => { const [x, y] = T([p.x, p.y]); return { x, y, in: T(p.in), out: T(p.out) }; })) }));
fs.writeFileSync(path.join(ROOT, 'rig3/stand_body.json'), JSON.stringify({ scale: S, cut: CUT, layers }));

const d = cs => cs.map(c => `M${c[0].x},${c[0].y}` + c.map((p, i) => { const q = c[(i + 1) % c.length]; return `C${p.out[0]},${p.out[1]} ${q.in[0]},${q.in[1]} ${q.x},${q.y}`; }).join('') + 'Z').join('');
const parts = fs.readFileSync(path.join(ROOT, 'out/mascot_parts.svg'), 'utf8'), variants = fs.readFileSync(path.join(ROOT, 'out/mascot_variants.svg'), 'utf8');
const group = (svg, id) => svg.match(new RegExp(`<g id="${id}"[^>]*>[\\s\\S]*?</g>`))[0];
const body = layers.map(l => `<path d="${d(l.contours)}" fill="${l.color}"/>`).join('\n');
// the original head's left cheek is flat (the raised fist covered it) → its mirror goes behind to complete the left side
const AXIS = +(process.argv[4] ?? 628);
const headMirror = `<g id="head_mirror" transform="matrix(-1 0 0 1 ${2 * AXIS} 0)">${group(parts, 'head').replace(/^<g id="head">/, '').replace(/<\/g>$/, '')}</g>`;
// original head everywhere except its flat left cheek (x < CHEEK_X below y CHEEK_Y), where the mirror shows
const CHEEK_X = +(process.argv[5] ?? 480), CHEEK_Y = +(process.argv[6] ?? 320);
const KEEP = `M0,0H1254V1254H${CHEEK_X}V${CHEEK_Y}H0Z`;
const over = group(parts, 'collar') + ['ear_L', 'ear_R'].map(id => group(parts, id)).join('\n') + headMirror + `<g clip-path="url(#keepHead)">${group(parts, 'head')}</g>` + [ 'eye_L', 'eye_R', 'blush_L', 'blush_R', 'nose'].map(id => group(parts, id)).join('\n') + group(variants, 'mouth_closed') + group(parts, 'medal');
const svg = `<svg width="1254" height="1254" viewBox="0 0 1254 1254" fill="none" xmlns="http://www.w3.org/2000/svg">\n<defs><clipPath id="keepHead"><path d="${KEEP}"/></clipPath></defs>\n<g id="stand_body">${body}</g>\n${over}\n</svg>`;
fs.writeFileSync(path.join(ROOT, 'rig3/stand_composite.svg'), svg);
const out = await renderSvg(browser, svg, 1254);
fs.writeFileSync(path.join(ROOT, 'rig3/stand_composite.png'), out);
await browser.close();
console.log('→ rig3/stand_composite.png');
