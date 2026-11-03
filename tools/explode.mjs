// node tools/explode.mjs [factor] → check/exploded.png : every part pushed away from the body centre,
// face features riding with the head, so the split (and the still-open joints) can be inspected.
import fs from 'node:fs';
import { launch } from './browser.mjs';

const factor = +(process.argv[2] || 0.35);
const svg = fs.readFileSync(new URL('../out/mascot_parts.svg', import.meta.url), 'utf8');
const FOLLOW_HEAD = ['eye_L', 'eye_R', 'blush_L', 'blush_R', 'nose', 'mouth'];
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1600 } });
await page.setContent(`<body style="margin:0;background:#fff">${svg.replace('width="1254" height="1254" viewBox="0 0 1254 1254"', 'width="1600" height="1600" viewBox="-180 -180 1614 1614"')}</body>`);
await page.evaluate(({ factor, FOLLOW_HEAD }) => {
  const C = { x: 627, y: 640 };
  const off = {};
  for (const g of document.querySelectorAll('svg > g')) {
    if (FOLLOW_HEAD.includes(g.id)) continue;
    const b = g.getBBox(), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    off[g.id] = [(cx - C.x) * factor, (cy - C.y) * factor];
  }
  for (const id of FOLLOW_HEAD) off[id] = off.head;
  for (const g of document.querySelectorAll('svg > g')) {
    const [dx, dy] = off[g.id];
    g.setAttribute('transform', `translate(${dx} ${dy})`);
    const b = g.getBBox();
    if (!FOLLOW_HEAD.includes(g.id) && !g.id.startsWith('fx_')) {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', b.x + b.width / 2 + dx); t.setAttribute('y', b.y + b.height + dy + 22);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font', '600 17px ui-monospace, monospace');
      t.setAttribute('style', 'font: 600 17px ui-monospace, Menlo, monospace'); t.setAttribute('fill', '#555');
      t.textContent = g.id; g.ownerSVGElement.appendChild(t);
    }
  }
}, { factor, FOLLOW_HEAD });
await page.screenshot({ path: new URL('../check/exploded.png', import.meta.url).pathname });
await browser.close();
