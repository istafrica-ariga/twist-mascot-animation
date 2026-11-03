// node riv/video.mjs <file.riv> <animation> <out.mp4> [fps] [seconds]
// Scrubs the animation in the official runtime and encodes the frames.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { launch } from '../tools/browser.mjs';

const [, , file, animName, out, fpsArg, secArg] = process.argv;
const FPS = Number(fpsArg || 30), SEC = Number(secArg || 4);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rivframes-'));

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('  [pageerror]', e.message));
await page.route('http://riv.local/**', r => {
  const p = decodeURIComponent(new URL(r.request().url()).pathname);
  if (p === '/index.html') return r.fulfill({
    body: '<html><body style="margin:0"><canvas id="c" width="540" height="960"></canvas><script src="/rive.js"></script></body></html>',
    contentType: 'text/html'
  });
  const f = p === '/file.riv' ? path.resolve(file)
    : p === '/rive.wasm' ? path.join(ROOT, 'node_modules/@rive-app/canvas/rive.wasm')
      : p === '/rive.js' ? path.join(ROOT, 'node_modules/@rive-app/canvas/rive.js') : null;
  if (!f) return r.fulfill({ status: 404 });
  r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
});
await page.goto('http://riv.local/index.html');
await page.waitForFunction(() => window.rive);
await page.evaluate(async ({ animName }) => {
  rive.RuntimeLoader.setWasmUrl('http://riv.local/rive.wasm');
  window.__r = await new Promise(res => {
    const x = new rive.Rive({
      src: 'http://riv.local/file.riv', canvas: document.getElementById('c'), animations: [animName], autoplay: false,
      layout: new rive.Layout({ fit: rive.Fit.contain, alignment: rive.Alignment.center }), onLoad: () => res(x)
    });
  });
}, { animName });

const n = Math.round(FPS * SEC);
for (let i = 0; i < n; i++) {
  await page.evaluate(async ({ animName, t }) => {
    window.__r.scrub(animName, t);
    await new Promise(z => requestAnimationFrame(() => requestAnimationFrame(z)));
  }, { animName, t: i / FPS });
  await page.screenshot({ path: path.join(tmp, String(i).padStart(4, '0') + '.png') });
  if (i % 20 === 0) process.stdout.write(`\r  frame ${i}/${n}`);
}
console.log(`\r  ${n} frames`);
await browser.close();

execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(tmp, '%04d.png'),
  '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
