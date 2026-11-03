// node riv/zoom.mjs <file.riv> <animation> <out.png> [frames] [scale] — character crops of one animation, hi-res
import fs from 'node:fs';
import path from 'node:path';
import { launch } from '../tools/browser.mjs';
import { loadSchema, decode } from './decode.mjs';
const [, , file, anim, out, nArg = '10', sArg = '4'] = process.argv;
const N = +nArg, S = +sArg, W = 393 * S, H = 461 * S;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { objects } = decode(fs.readFileSync(file), loadSchema());
const a = objects.find(o => o.type === 'LinearAnimation' && o.p.name === anim);
const dur = (a.p.duration ?? 60) / (a.p.fps ?? 60);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.route('http://riv.local/**', r => {
  const p = new URL(r.request().url()).pathname;
  if (p === '/index.html') return r.fulfill({ body: `<html><body style="margin:0"><canvas id="c" width="${W}" height="${H}"></canvas><script src="/rive.js"></script></body></html>`, contentType: 'text/html' });
  const f = { '/file.riv': path.resolve(file), '/rive.wasm': path.join(ROOT, 'node_modules/@rive-app/canvas/rive.wasm'), '/rive.js': path.join(ROOT, 'node_modules/@rive-app/canvas/rive.js') }[p];
  f ? r.fulfill({ body: fs.readFileSync(f), contentType: p.endsWith('.wasm') ? 'application/wasm' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }) : r.fulfill({ status: 404 });
});
await page.goto('http://riv.local/index.html');
await page.waitForFunction(() => window.rive);
const frames = await page.evaluate(async ({ anim, dur, N, W, H }) => {
  rive.RuntimeLoader.setWasmUrl('http://riv.local/rive.wasm');
  const cv = document.getElementById('c');
  const r = await new Promise(res => { const x = new rive.Rive({ src: 'http://riv.local/file.riv', canvas: cv, animations: [anim], autoplay: false, onLoad: () => res(x) }); });
  const shots = [];
  for (let k = 0; k < N; k++) {
    r.scrub(anim, dur * k / (N - 1)); await new Promise(q => requestAnimationFrame(() => requestAnimationFrame(q)));
    shots.push(cv.toDataURL('image/png'));
  }
  return shots;
}, { anim, dur, N, W, H });
const dir = out.replace(/\.png$/, '');
fs.mkdirSync(dir, { recursive: true });
frames.forEach((d, k) => fs.writeFileSync(`${dir}/f${String(k).padStart(2, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')));
console.log(`${N} frames (${dur.toFixed(2)}s) → ${dir}/`);
await browser.close();
