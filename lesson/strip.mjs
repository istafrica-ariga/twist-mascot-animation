// Render a strip across an animation's timeline, so a take can be judged instead of assumed.
//
//   node lesson/strip.mjs <file.riv> "<Animation Name>" [steps]
import fs from 'node:fs';
import path from 'node:path';
import { launch } from '../tools/browser.mjs';

const [, , file, animName, stepsArg] = process.argv;
const STEPS = Number(stepsArg || 7);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = `${ROOT}/lesson/strips`;
fs.mkdirSync(OUT, { recursive: true });
const W = 420, H = 420;

const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', e => console.error('  [page]', e.message));

await page.route('http://riv.local/**', r => {
  const p = decodeURIComponent(new URL(r.request().url()).pathname);
  if (p === '/index.html') {
    return r.fulfill({
      contentType: 'text/html',
      body: `<html><body style="margin:0;background:#fff">
        <canvas id="c" width="${W}" height="${H}"></canvas><script src="/rive.js"></script></body></html>`,
    });
  }
  const f = p === '/file.riv' ? path.resolve(file)
    : p === '/rive.wasm' ? `${ROOT}/node_modules/@rive-app/canvas/rive.wasm`
      : p === '/rive.js' ? `${ROOT}/node_modules/@rive-app/canvas/rive.js` : null;
  if (!f) return r.abort();
  return r.fulfill({
    body: fs.readFileSync(f),
    contentType: p.endsWith('.wasm') ? 'application/wasm' : 'application/javascript',
  });
});
await page.goto('http://riv.local/index.html');

await page.evaluate(anim => new Promise(resolve => {
  const r = new window.rive.Rive({
    src: '/file.riv', canvas: document.getElementById('c'), artboard: 'Artboard 3',
    animations: anim, autoplay: true,
    layout: new window.rive.Layout({ fit: 'contain' }),
    onLoad: () => { window.__r = r; r.pause(); resolve(true); },
  });
}), animName);

const shots = [];
for (let k = 0; k < STEPS; k++) {
  const frac = k / (STEPS - 1);
  await page.evaluate(({ anim, frac }) => { window.__r.scrub(anim, frac); }, { anim: animName, frac });
  await page.waitForTimeout(90);
  const f = `${OUT}/_${k}.png`;
  // The artboard is 347 px square and the character sits small inside it, so a full-canvas
  // screenshot is mostly empty paper and far too small to judge a performance from.
  await page.screenshot({ path: f, clip: { x: 128, y: 96, width: 168, height: 190 } });
  shots.push({ frac, f });
}
await browser.close();

const slug = animName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const html = `<!doctype html><meta charset="utf-8"><style>
 body{margin:0;background:#15052E;font-family:-apple-system,sans-serif;padding:18px}
 h1{color:#fff;font-size:16px;margin:0 0 12px}
 .r{display:flex;gap:7px}.c{width:150px}
 .c img{width:100%;border-radius:7px;display:block;background:#fff}
 .c div{color:#C9B8F0;font-size:11px;text-align:center;margin-top:5px}
</style><h1>${animName}</h1><div class="r">
${shots.map(s => `<div class="c"><img src="${b64(s.f)}"><div>${(s.frac * 100).toFixed(0)}%</div></div>`).join('')}
</div>`;
const b2 = await launch();
const p2 = await b2.newPage({ viewport: { width: 170 * STEPS + 40, height: 260 } });
await p2.setContent(html);
await p2.screenshot({ path: `${OUT}/${slug}.png`, fullPage: true });
await b2.close();
shots.forEach(s => fs.unlinkSync(s.f));
console.log(`wrote ${OUT}/${slug}.png`);
