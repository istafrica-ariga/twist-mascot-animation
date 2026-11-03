// The reference video against the generated clip, sampled at the same timestamps.
import fs from 'node:fs';
import { launch } from './browser.mjs';

const DIR = '/Users/ariga/Documents/mascot/out/masko_redo/cmp';
const OUT = '/Users/ariga/Documents/mascot/out/masko_redo/compare.png';
const TIMES = ['0.00', '0.50', '1.00', '1.30', '1.70', '2.10', '2.60', '3.40'];

const b64 = f => 'data:image/png;base64,' + fs.readFileSync(`${DIR}/${f}`).toString('base64');
const strip = p => TIMES.map(t => `<img src="${b64(`${p}_${t}.png`)}">`).join('');

const html = `<!doctype html><meta charset="utf-8"><style>
  :root { color-scheme: dark }
  body { margin:0; background:#15052E; font-family:-apple-system,"SF Pro Text",Helvetica,sans-serif; padding:26px }
  h1 { color:#fff; font-size:25px; margin:0 0 4px; letter-spacing:-.3px }
  .sub { color:#B9A6E8; font-size:13.5px; margin:0 0 22px }
  .lab { display:flex; align-items:baseline; gap:11px; margin:0 0 9px }
  .lab b { color:#fff; font-size:17px }
  .lab span { color:#9B86D4; font-size:13px }
  .strip { display:flex; gap:8px; margin-bottom:20px }
  .strip img { width:188px; border-radius:7px; display:block }
  .beats { display:flex; gap:8px; margin-top:-12px }
  .beats div { width:188px; color:#C9B8F0; font-size:12px; letter-spacing:1px; text-align:center }
</style>
<h1>Reference against the generated clip</h1>
<p class="sub">Same timestamps. The generated clip was retimed 5.17 s &rarr; 4.04 s to match the reference's length.</p>
<div class="lab"><b>Your reference</b><span>1920&times;3416, 24 fps, 4.04 s</span></div>
<div class="strip">${strip('ref')}</div>
<div class="lab"><b>Generated</b><span>MiniMax H3 Max Turbo, both ends pinned, 250 credits</span></div>
<div class="strip">${strip('gen')}</div>
<div class="beats">${TIMES.map(t => `<div>${t}s</div>`).join('')}</div>`;

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1620, height: 1000 } });
await page.setContent(html);
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log('wrote', OUT);
