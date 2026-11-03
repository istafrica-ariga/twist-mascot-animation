// Render the traced SVG at device resolution and put it beside the video frame at the same size.
// The question is only whether vectorising buys sharpness at the size the phone actually draws.
import fs from 'node:fs';
import { launch } from './browser.mjs';

const DIR = '/Users/ariga/Documents/mascot/out/masko_redo/trace';
const svg = fs.readFileSync(`${DIR}/f_049_traced.svg`, 'utf8');

// The mascot occupies x 188-585, y 205-571 of the 768x1344 source. On an iPhone 17 Pro the frame
// is drawn 1206 px wide, so scale by 1206/768 and crop that box.
const K = 1206 / 768;
const W = Math.round(397 * K), H = Math.round(366 * K);

const html = `<!doctype html><meta charset="utf-8"><style>
  html,body { margin:0; background:#fff }
  #wrap { width:${W}px; height:${H}px; overflow:hidden; position:relative }
  #wrap svg { position:absolute; left:${-188 * K}px; top:${-205 * K}px;
              width:${768 * K}px; height:${1344 * K}px }
</style><div id="wrap">${svg}</div>`;

const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.screenshot({ path: `${DIR}/sharp_vector.png` });
await browser.close();
console.log(`wrote ${DIR}/sharp_vector.png  ${W}x${H}`);
