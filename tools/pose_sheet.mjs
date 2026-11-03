// Side-by-side: the two reference images we conditioned on, and the pose OpenRouter invented.
import fs from 'node:fs';
import { launch } from './browser.mjs';

const SP = '/private/tmp/claude-501/-Users-ariga-Documents/61691007-1362-4343-a7b7-94ea428fda32/scratchpad/masko';
const OUT = '/Users/ariga/Documents/mascot/out/openrouter/compare.png';

const PANELS = [
  [`${SP}/pose_3.png`, 'Reference 1', 'standing — sent as input', 'ref'],
  [`${SP}/pose_2.png`, 'Reference 2', 'flying — sent as input', 'ref'],
  ['/Users/ariga/Documents/mascot/out/openrouter/celebrating_both_paws_raised_above_the_h.png',
   'Generated', 'celebrating — a pose in neither reference', 'new'],
];

const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

const html = `<!doctype html><meta charset="utf-8"><style>
  :root { color-scheme: dark }
  body { margin:0; background:#15052E; font-family:-apple-system,"SF Pro Text",Helvetica,sans-serif; padding:28px }
  h1 { color:#fff; font-size:26px; margin:0 0 5px; letter-spacing:-.3px }
  .sub { color:#B9A6E8; font-size:14px; margin:0 0 24px }
  .grid { display:flex; gap:16px }
  .cell { width:560px }
  .cell img { width:100%; border-radius:12px; display:block; background:#fff }
  .lab { display:flex; align-items:baseline; gap:10px; margin:0 0 10px }
  .lab b { color:#fff; font-size:17px }
  .lab span { color:#9B86D4; font-size:13px }
  .tag { display:inline-block; font-size:11px; letter-spacing:1.1px; text-transform:uppercase;
         padding:3px 9px; border-radius:20px; margin-left:auto }
  .ref .tag { background:#2E1A52; color:#B9A6E8 }
  .new .tag { background:#3B1263; color:#FFD36B }
</style>
<h1>Gemini 3 Pro Image via OpenRouter — identity test</h1>
<p class="sub">Both references were sent on the same call, with the character brief we gave Masko, word for word. $0.1401, 34.6 s.</p>
<div class="grid">
${PANELS.map(([f, label, note, kind]) => `
  <div class="cell ${kind}">
    <div class="lab"><b>${label}</b><span>${note}</span>
      <span class="tag">${kind === 'ref' ? 'input' : 'output'}</span></div>
    <img src="${b64(f)}">
  </div>`).join('')}
</div>`;

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 820 } });
await page.setContent(html);
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log('wrote', OUT);
