import fs from 'node:fs';
import { launch, renderSvg } from './browser.mjs';
const [, , src, out, x0 = 0, y0 = 0, w = 1254, step = 50] = process.argv.map((v, i) => i > 3 ? +v : v);
let svg = fs.readFileSync(src, 'utf8');
let g = '';
for (let v = 0; v <= 1254; v += step) {
  const major = v % (step*5) === 0;
  g += `<line x1="${v}" y1="0" x2="${v}" y2="1254" stroke="${major ? '#0a0' : '#0c0'}" stroke-width="${major ? 1.2 : 0.5}" opacity=".7"/><line x1="0" y1="${v}" x2="1254" y2="${v}" stroke="${major ? '#0a0' : '#0c0'}" stroke-width="${major ? 1.2 : 0.5}" opacity=".7"/>`;
  if (major) for (let u = 0; u <= 1254; u += step*5) g += `<text x="${v + 2}" y="${u + 11}" font-size="10" fill="#060" font-family="monospace">${v},${u}</text>`;
}
svg = svg.replace(/viewBox="[^"]*"/, `viewBox="${x0} ${y0} ${w} ${w}"`).replace('</svg>', g + '</svg>');
const browser = await launch();
fs.writeFileSync(out, await renderSvg(browser, svg, 1400));
await browser.close();
