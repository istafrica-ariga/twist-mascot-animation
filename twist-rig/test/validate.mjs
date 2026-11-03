// node twist-rig/test/validate.mjs <file.riv> <animation> [frames=6] [scale=1.5]
// Renders the same frames three ways — official Rive runtime, our engine → Canvas 2D, our engine → React Native
// Skia (its web build: JsiSkApi over CanvasKit) — and diffs ours against official.
// Output: check/twistrig_<animation>.png (rows: official / canvas2d / skia / skia-diff).
import fs from 'node:fs';
import path from 'node:path';
import { launch } from '../../tools/browser.mjs';
import { modelFromRiv } from '../../engine/from-riv.mjs';

const [, , file, animName, nArg = '6', sArg = '1.5'] = process.argv;
const N = +nArg, S = +sArg;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const APP = path.resolve(ROOT, '../twist-mobile-develop/node_modules');
const model = modelFromRiv(file);
const anim = model.animations.find(a => a.name === animName);
const dur = anim.duration / anim.fps;
const W = Math.round(model.width * S), H = Math.round(model.height * S);
const files = {
  '/file.riv': path.resolve(file), '/rive.wasm': path.join(ROOT, 'node_modules/@rive-app/canvas/rive.wasm'), '/rive.js': path.join(ROOT, 'node_modules/@rive-app/canvas/rive.js'),
  '/bundle.js': path.join(ROOT, 'twist-rig/test/dist/bundle.js'),
  '/canvaskit.js': path.join(APP, 'canvaskit-wasm/bin/full/canvaskit.js'), '/canvaskit.wasm': path.join(APP, 'canvaskit-wasm/bin/full/canvaskit.wasm'),
};
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on('pageerror', e => console.log('  [pageerror]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('  [page]', m.text()); });
await page.route('http://riv.local/**', r => {
  const p = new URL(r.request().url()).pathname;
  if (p === '/index.html') return r.fulfill({ body: `<html><body style="margin:0"><script src="/rive.js"></script><script src="/canvaskit.js"></script><script src="/bundle.js"></script></body></html>`, contentType: 'text/html' });
  if (p === '/model.json') return r.fulfill({ body: JSON.stringify(model), contentType: 'application/json' });
  const f = files[p];
  f ? r.fulfill({ body: fs.readFileSync(f), contentType: p.endsWith('.wasm') ? 'application/wasm' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }) : r.fulfill({ status: 404 });
});
await page.goto('http://riv.local/index.html');
await page.waitForFunction(() => window.rive && window.CanvasKitInit && window.TwistRig);
const res = await page.evaluate(async ({ animName, dur, N, W, H, S }) => {
  const { compileRig, createPose, resetPose, applyAnimation, solve, displayList, drawCanvas2D, drawSkia } = window.TwistRig;
  const CanvasKit = await CanvasKitInit({ locateFile: f => 'http://riv.local/' + f });
  const Skia = window.JsiSkApi(CanvasKit);
  const model = await (await fetch('http://riv.local/model.json')).json();
  const rig = compileRig(model), pose = createPose(rig), anim = model.animations.find(a => a.name === animName);
  rive.RuntimeLoader.setWasmUrl('http://riv.local/rive.wasm');
  const offi = document.createElement('canvas'); offi.width = W; offi.height = H; document.body.appendChild(offi);
  const r = await new Promise(res => { const x = new rive.Rive({ src: 'http://riv.local/file.riv', canvas: offi, animations: [animName], autoplay: false, onLoad: () => res(x) }); });
  const c2d = document.createElement('canvas'); c2d.width = W; c2d.height = H;
  const sheet = document.createElement('canvas'); sheet.width = W * N; sheet.height = H * 4;
  const g = sheet.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, sheet.width, sheet.height);
  const onWhite = src => { const t = document.createElement('canvas'); t.width = W; t.height = H; const x = t.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(src, 0, 0); return x.getImageData(0, 0, W, H); };
  const diff = (A, B) => { const D = new ImageData(W, H); let bad = 0; for (let i = 0; i < A.data.length; i += 4) { const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2])); if (d > 48) { bad++; D.data.set([255, 0, 0, 255], i); } else { const v = 200 + (A.data[i] + A.data[i + 1] + A.data[i + 2]) / 15; D.data.set([v, v, v, 255], i); } } return { D, pct: +(100 * bad / (W * H)).toFixed(3) }; };
  const stats = { canvas2d: [], skia: [] };
  let evalMs = 0;
  for (let k = 0; k < N; k++) {
    const t = dur * k / (N - 1);
    r.scrub(animName, t); await new Promise(q => requestAnimationFrame(() => requestAnimationFrame(q)));
    const t0 = performance.now();
    resetPose(rig, pose); applyAnimation(rig, pose, anim, t); solve(rig, pose);
    const list = displayList(rig, pose, [S, 0, 0, S, 0, 0]);
    evalMs += performance.now() - t0;
    const ctx = c2d.getContext('2d'); ctx.clearRect(0, 0, W, H); drawCanvas2D(ctx, list);
    // Skia: raster surface via RN Skia's API, then read back RGBA
    const surface = Skia.Surface.Make(W, H); const canvas = surface.getCanvas(); canvas.clear(Skia.Color('white'));
    drawSkia(Skia, canvas, list); surface.flush();
    const img = surface.makeImageSnapshot();
    const px = img.readPixels(0, 0, { width: W, height: H, colorType: 4, alphaType: 1 }); // RGBA_8888, premul
    const sk = new ImageData(new Uint8ClampedArray(px.buffer ?? px), W, H);
    const O = onWhite(offi), C = onWhite(c2d);
    const dc = diff(C, O), ds = diff(sk, O);
    stats.canvas2d.push(dc.pct); stats.skia.push(ds.pct);
    g.putImageData(O, k * W, 0); g.putImageData(C, k * W, H); g.putImageData(sk, k * W, 2 * H); g.putImageData(ds.D, k * W, 3 * H);
  }
  return { stats, evalMs: +(evalMs / N).toFixed(2), png: sheet.toDataURL('image/png') };
}, { animName, dur, N, W, H, S });
const out = path.join(ROOT, 'check', `twistrig_${animName.replace(/\W+/g, '_')}.png`);
fs.writeFileSync(out, Buffer.from(res.png.split(',')[1], 'base64'));
console.log(`${animName}  canvas2d vs official: ${res.stats.canvas2d.join(' · ')}\n${' '.repeat(animName.length)}  skia     vs official: ${res.stats.skia.join(' · ')}\n  engine evaluate+displayList: ${res.evalMs} ms/frame  → ${out}`);
await browser.close();
