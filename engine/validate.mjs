// node engine/validate.mjs <file.riv> <animation> [frames=6] [scale=2]
// Renders the same frames with OUR engine and with the official Rive runtime, side by side + pixel diff.
// Output: check/engine_<animation>.png (rows: ours / official / diff) and a mismatch % per frame.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from '../tools/browser.mjs';
import { modelFromRiv } from './from-riv.mjs';

const [, , file, animName, nArg = '6', sArg = '2'] = process.argv;
const N = +nArg, S = +sArg;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const model = modelFromRiv(file);
const anim = model.animations.find(a => a.name === animName);
const dur = anim.duration / anim.fps;
const W = Math.round(model.width * S), H = Math.round(model.height * S);

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on('pageerror', e => console.log('  [pageerror]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('  [page]', m.text()); });
await page.route('http://riv.local/**', r => {
  const p = new URL(r.request().url()).pathname;
  if (p === '/index.html') return r.fulfill({ body: `<html><body style="margin:0"><script src="/rive.js"></script></body></html>`, contentType: 'text/html' });
  if (p === '/model.json') return r.fulfill({ body: JSON.stringify(model), contentType: 'application/json' });
  const f = { '/file.riv': path.resolve(file), '/rive.wasm': path.join(ROOT, 'node_modules/@rive-app/canvas/rive.wasm'), '/rive.js': path.join(ROOT, 'node_modules/@rive-app/canvas/rive.js'), '/engine.mjs': path.join(ROOT, 'engine/engine.mjs') }[p];
  f ? r.fulfill({ body: fs.readFileSync(f), contentType: p.endsWith('.wasm') ? 'application/wasm' : /\.m?js$/.test(p) ? 'text/javascript' : 'application/octet-stream' }) : r.fulfill({ status: 404 });
});
await page.goto('http://riv.local/index.html');
await page.waitForFunction(() => window.rive);
const res = await page.evaluate(async ({ animName, dur, N, W, H, S }) => {
  const { Scene } = await import('http://riv.local/engine.mjs');
  const model = await (await fetch('http://riv.local/model.json')).json();
  const scene = new Scene(model);
  const anim = model.animations.find(a => a.name === animName);
  rive.RuntimeLoader.setWasmUrl('http://riv.local/rive.wasm');
  const offi = document.createElement('canvas'); offi.width = W; offi.height = H; document.body.appendChild(offi);
  const r = await new Promise(res => { const x = new rive.Rive({ src: 'http://riv.local/file.riv', canvas: offi, animations: [animName], autoplay: false, onLoad: () => res(x) }); });
  const ours = document.createElement('canvas'); ours.width = W; ours.height = H;
  const sheet = document.createElement('canvas'); sheet.width = W * N; sheet.height = H * 3;
  const g = sheet.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, sheet.width, sheet.height);
  const white = c => { const t = document.createElement('canvas'); t.width = W; t.height = H; const x = t.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(c, 0, 0); return x.getImageData(0, 0, W, H); };
  const stats = [];
  for (let k = 0; k < N; k++) {
    const t = dur * k / (N - 1);
    r.scrub(animName, t); await new Promise(q => requestAnimationFrame(() => requestAnimationFrame(q)));
    scene.reset(); scene.applyAnimation(anim, t); scene.update();
    const ctx = ours.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    scene.draw(ctx, [S, 0, 0, S, 0, 0]);
    const A = white(ours), B = white(offi), D = new ImageData(W, H); let bad = 0;
    for (let i = 0; i < A.data.length; i += 4) {
      const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
      if (d > 48) { bad++; D.data.set([255, 0, 0, 255], i); } else { const v = 200 + (A.data[i] + A.data[i + 1] + A.data[i + 2]) / 15; D.data.set([v, v, v, 255], i); }
    }
    stats.push(+(100 * bad / (W * H)).toFixed(3));
    g.putImageData(A, k * W, 0); g.putImageData(B, k * W, H); g.putImageData(D, k * W, 2 * H);
  }
  return { stats, png: sheet.toDataURL('image/png') };
}, { animName, dur, N, W, H, S });
fs.mkdirSync(path.join(ROOT, 'check'), { recursive: true });
const out = path.join(ROOT, 'check', `engine_${animName.replace(/\W+/g, '_')}.png`);
fs.writeFileSync(out, Buffer.from(res.png.split(',')[1], 'base64'));
console.log(`${animName}: mismatch per frame (% pixels, ours vs official) = ${res.stats.join(' · ')}  → ${out}`);
await browser.close();
