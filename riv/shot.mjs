// node riv/shot.mjs <file.riv> <animation> <out.png> [t0,t1,...]  — full-size frames, side by side.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from '../tools/browser.mjs';

const [, , file, animName, out, timesArg] = process.argv;
const times = (timesArg || '0.2,0.35,0.6,1.4,2.6').split(',').map(Number);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 560 * times.length, height: 1000 } });
page.on('pageerror', e => console.log('  [pageerror]', e.message));
await page.route('http://riv.local/**', r => {
  const p = decodeURIComponent(new URL(r.request().url()).pathname);
  if (p === '/index.html') return r.fulfill({
    body: `<html><body style="margin:0;background:#111;display:flex;gap:8px">` +
      times.map((_, i) => `<canvas id="c${i}" width="540" height="960"></canvas>`).join('') +
      `<script src="/rive.js"></script></body></html>`, contentType: 'text/html'
  });
  const f = p === '/file.riv' ? path.resolve(file)
    : p === '/rive.wasm' ? path.join(ROOT, 'node_modules/@rive-app/canvas/rive.wasm')
      : p === '/rive.js' ? path.join(ROOT, 'node_modules/@rive-app/canvas/rive.js') : null;
  if (!f) return r.fulfill({ status: 404 });
  r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
});
await page.goto('http://riv.local/index.html');
await page.waitForFunction(() => window.rive);

await page.evaluate(async ({ animName, times }) => {
  rive.RuntimeLoader.setWasmUrl('http://riv.local/rive.wasm');
  for (let i = 0; i < times.length; i++) {
    const cv = document.getElementById('c' + i);
    const r = await new Promise(res => {
      const x = new rive.Rive({
        src: 'http://riv.local/file.riv', canvas: cv, animations: [animName], autoplay: false,
        layout: new rive.Layout({ fit: rive.Fit.contain, alignment: rive.Alignment.center }),
        onLoad: () => res(x)
      });
    });
    r.scrub(animName, times[i]);
    await new Promise(z => requestAnimationFrame(() => requestAnimationFrame(z)));
  }
}, { animName, times });

await page.screenshot({ path: out });
await browser.close();
console.log('wrote', out, '— times', times.join(', '));
