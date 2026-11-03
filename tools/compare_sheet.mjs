// Labelled beat-by-beat comparison grid: the rig build against the Masko generation.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './browser.mjs';

const SP = '/private/tmp/claude-501/-Users-ariga-Documents/61691007-1362-4343-a7b7-94ea428fda32/scratchpad/cmp';
const OUT = process.env.CMP_OUT || '/Users/ariga/Documents/mascot/out/launch/compare_beats.png';
const ROWS = JSON.parse(process.env.CMP_ROWS || '[["rig","Your rig","vector parts, 1080×1920, 30 fps, 4.06 s"],["mas","Masko","generated video, 720×720 overlay, 24 fps, 3.75 s, 8 credits"]]');
const BEATS = ['0.40s  stand', '1.10s  crouch', '1.30s  launch', '1.70s  rise', '2.40s  settle', '3.40s  hover'];

const b64 = f => 'data:image/png;base64,' + fs.readFileSync(path.join(SP, f)).toString('base64');
const row = (prefix, label, note) => `
  <div class="lab"><b>${label}</b><span>${note}</span></div>
  <div class="strip">${BEATS.map((_, i) => `<img src="${b64(`${prefix}_${i + 1}.png`)}">`).join('')}</div>`;

const html = `<!doctype html><meta charset="utf-8"><style>
  :root { color-scheme: dark }
  body { margin:0; background:#15052E; font-family:-apple-system,"SF Pro Text",Helvetica,sans-serif; padding:26px 26px 30px }
  h1 { color:#fff; font-size:25px; margin:0 0 4px; letter-spacing:-.3px }
  .sub { color:#B9A6E8; font-size:14px; margin:0 0 22px }
  .lab { display:flex; align-items:baseline; gap:11px; margin:0 0 9px }
  .lab b { color:#fff; font-size:17px }
  .lab span { color:#9B86D4; font-size:13px }
  .strip { display:flex; gap:9px; margin-bottom:22px }
  .strip img { width:330px; border-radius:9px; display:block }
  .beats { display:flex; gap:9px; margin-top:-14px }
  .beats div { width:330px; color:#C9B8F0; font-size:12.5px; letter-spacing:.9px; text-transform:uppercase; text-align:center }
</style>
<h1>${process.env.CMP_TITLE || 'Twist launch — same beats, two builds'}</h1>
<p class="sub">Frames pulled at matching timestamps from each clip.</p>
${ROWS.map(r => row(...r)).join('')}
<div class="beats">${BEATS.map(b => `<div>${b}</div>`).join('')}</div>`;

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 2090, height: 1400 } });
await page.setContent(html);
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log('wrote', OUT);
