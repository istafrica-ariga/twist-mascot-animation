// node tools/variants.mjs → out/mascot_variants.svg (swap-in art for Rive solos) + check/variants_*.png previews
//
//   arm_L_stand / hand_L_stand – the right arm + paw mirrored (both paws up at the chest, as in the video's stand)
//   leg_L_stand                – the right leg mirrored (both feet planted)
//   mouth_closed               – smile line + the two buck teeth (outlined, since they now sit on skin)
//   mouth_mid                  – open mouth at ~half height, tongue scaled into it, teeth unchanged
import fs from 'node:fs';
import path from 'node:path';
import { launch, renderSvg } from './browser.mjs';
import { OUTLINE } from '../parts/spec.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const parts = fs.readFileSync(path.join(ROOT, 'out/mascot_parts.svg'), 'utf8');
const solo = fs.readFileSync(path.join(ROOT, 'out/mascot_solo.svg'), 'utf8');
const soloGroup = id => solo.match(new RegExp(`<g id="${id}">([\\s\\S]*?)</g>`))[1];
const group = id => parts.match(new RegExp(`<g id="${id}">([\\s\\S]*?)</g>`))[1];
const paths = id => [...group(id).matchAll(/<path[^>]*?d="([^"]+)"[^>]*?fill="([^"]+)"/g)].map(m => ({ d: m[1], fill: m[2], src: (m[0].match(/data-src="(\d+)"/) || [])[1] }));

import { AXIS } from '../parts/spec.mjs';
const mirror = `matrix(-1 0 0 1 ${2 * AXIS} 0)`;
const rename = (id, to) => soloGroup(id).replace(new RegExp(`id="${id}__`, 'g'), `id="${to}__`);

// mouth pieces (trace indices): 8 dark mouth, 9/10 tongue, 11/12 left tooth, 13/14 right tooth
const m = Object.fromEntries(paths('mouth').map(p => [p.src, p]));
const TOP = 372; // the open mouth's top edge = where the lips meet

const browser = await launch();
const page = await browser.newPage();
await page.addScriptTag({ path: path.join(ROOT, 'node_modules/paper/dist/paper-core.min.js') });
const baked = await page.evaluate(({ m, TOP }) => {
  paper.setup(new paper.Size(1254, 1254));
  const P = d => new paper.CompoundPath({ pathData: d, insert: false });
  // mid: dark mouth squashed to 52 % from its top edge; tongue 60 % about its base, lifted to the new floor, clipped
  const SY = 0.52, dark = P(m[8].d); dark.scale(1, SY, new paper.Point(630, TOP));
  const floor = dark.bounds.bottom, tongueBase = P(m[9].d).bounds.bottom;
  const tongue = [9, 10].map(i => {
    const t = P(m[i].d); t.scale(0.62, 0.6, new paper.Point(635, tongueBase)); t.translate(new paper.Point(0, floor - tongueBase - 6));
    return { fill: m[i].fill, d: t.intersect(dark, { insert: false }).pathData };
  });
  const teethOutline = P(m[11].d).unite(P(m[12].d), { insert: false }).unite(P(m[13].d).unite(P(m[14].d), { insert: false }), { insert: false });
  return { mid: [{ fill: m[8].fill, d: dark.pathData }, ...tongue], teethOutline: teethOutline.pathData };
}, { m, TOP });
await browser.close();

// closed: tapered smile line, ends curling up into the cheeks (≈8 thick mid, 5 at the ends)
const LIP = 'M486 364C489 371 495 377.5 506 378.5C560 383 700 383 750 378.5C761 377.5 767 371 770 364C766 369 759 371.5 750 371.5C700 375 560 375 506 371.5C497 371.5 490 369 486 364Z';
const teeth = [11, 12, 13, 14].map(i => `<path d="${m[i].d}" fill="${m[i].fill}"/>`).join('');
const LEG_K = (1016 - 789.8) / (1016 - 804.8);
const variants = {
  arm_L_stand: `<g id="arm_L_stand" transform="${mirror}">${rename('arm_R_upper', 'arm_L_stand')}</g>`,
  hand_L_stand: `<g id="hand_L_stand" transform="${mirror}">${rename('hand_R', 'hand_L_stand')}</g>`,
  // The torso isn't quite symmetric at the hips: the mirrored leg's outer hip corner (483.8, 804.8) must land on the
  // torso's (488, 789.8) while the sole stays on the ground line (y 1016) — so stretch it 7 % about the sole.
  leg_L_stand: `<g id="leg_L_stand" transform="translate(4.2 ${(1016 * (1 - LEG_K)).toFixed(2)}) scale(1 ${LEG_K.toFixed(4)}) ${mirror}">${rename('leg_R', 'leg_L_stand')}</g>`,
  mouth_mid: `<g id="mouth_mid">${baked.mid.map(p => `<path d="${p.d}" fill="${p.fill}"/>`).join('')}${teeth}</g>`,
  mouth_closed: `<g id="mouth_closed"><path id="mouth_closed__teeth_outline" d="${baked.teethOutline}" fill="${OUTLINE}" stroke="${OUTLINE}" stroke-width="9" stroke-linejoin="round"/>${teeth}<path id="mouth_closed__lip" d="${LIP}" fill="${OUTLINE}"/></g>`,
};
const wrap = body => `<svg width="1254" height="1254" viewBox="0 0 1254 1254" fill="none" xmlns="http://www.w3.org/2000/svg">\n${body}\n</svg>`;
fs.writeFileSync(path.join(ROOT, 'out/mascot_variants.svg'), wrap(Object.values(variants).join('\n')));

// ── previews ───────────────────────────────────────────────────────────────────────────────────────────────
// A pose = the layered SVG with some parts swapped: { hide: [...], add: { afterId: [variantIds] } }
export function posed({ hide = [], add = {} }) {
  let s = parts;
  for (const id of hide) s = s.replace(`<g id="${id}">`, `<g id="${id}" display="none">`);
  for (const [after, ids] of Object.entries(add)) {
    const end = s.indexOf('</g>', s.indexOf(`<g id="${after}">`) >= 0 ? s.indexOf(`<g id="${after}">`) : s.indexOf(`<g id="${after}" `)) + 4;
    s = s.slice(0, end) + '\n' + ids.map(v => variants[v]).join('\n') + s.slice(end);
  }
  return s;
}
const STAND = { hide: ['arm_L', 'hand_L', 'leg_L', 'mouth', 'fx_speedlines'], add: { hand_R: ['arm_L_stand', 'hand_L_stand'], leg_R: ['leg_L_stand'], nose: ['mouth_closed'] } };
const MID = { hide: ['mouth'], add: { nose: ['mouth_mid'] } };
const CLOSED = { hide: ['mouth'], add: { nose: ['mouth_closed'] } };

fs.writeFileSync(path.join(ROOT, 'check/stand.svg'), posed(STAND));
const b2 = await launch();
const crop = (svg, vb, w, h) => svg.replace('width="1254" height="1254" viewBox="0 0 1254 1254"', `width="${w}" height="${h}" viewBox="${vb}"`);
const shot = async (html, file, w, h) => { const pg = await b2.newPage({ viewport: { width: w, height: h } }); await pg.setContent(`<body style="margin:0;background:#fff;white-space:nowrap;font:600 20px Menlo;text-align:center">${html}</body>`); await pg.screenshot({ path: path.join(ROOT, 'check', file) }); await pg.close(); };
const cell = (svg, label) => `<div style="display:inline-block">${svg}<div>${label}</div></div>`;
const FACE = '400 150 460 460';
await shot([cell(crop(parts, FACE, 460, 460), 'open (original)'), cell(crop(posed(MID), FACE, 460, 460), 'mid'), cell(crop(posed(CLOSED), FACE, 460, 460), 'closed')].join(''), 'variants_mouths.png', 1380, 500);
const BODY = '170 60 920 1070';
await shot([cell(crop(parts, BODY, 600, 700), 'fly (original)'), cell(crop(posed(STAND), BODY, 600, 700), 'stand (new parts)')].join(''), 'variants_stand.png', 1200, 740);
await b2.close();
console.log('wrote out/mascot_variants.svg, check/variants_mouths.png, check/variants_stand.png');
