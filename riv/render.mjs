// node riv/render.mjs <file.riv> <outPrefix> [animation names…]
// Loads a .riv in headless Chromium with the official @rive-app/canvas runtime, lists artboards / animations /
// state machines (+ inputs), and renders a contact sheet of each animation (8 frames across its duration).
import fs from 'node:fs';
import path from 'node:path';
import { launch } from '../tools/browser.mjs';

const [, , file, out] = process.argv;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('console', m => console.log('  [page]', m.text()));
page.on('pageerror', e => console.log('  [pageerror]', e.message));
await page.route('http://riv.local/**', r => {
  const p = decodeURIComponent(new URL(r.request().url()).pathname);
  if (p === '/index.html') return r.fulfill({ body: '<html><body style="margin:0;background:#fff"><canvas id="c" width="400" height="470"></canvas><script src="/rive.js"></script></body></html>', contentType: 'text/html' });
  const f = p === '/file.riv' ? path.resolve(file) : p === '/rive.wasm' ? path.join(ROOT, 'node_modules/@rive-app/canvas/rive.wasm') : p === '/rive.js' ? path.join(ROOT, 'node_modules/@rive-app/canvas/rive.js') : null;
  if (!f) return r.fulfill({ status: 404 });
  r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
});
await page.goto('http://riv.local/index.html');
await page.waitForFunction(() => window.rive);
const info = await page.evaluate(() => new Promise((res, rej) => {
  rive.RuntimeLoader.setWasmUrl('http://riv.local/rive.wasm');
  const r = new rive.Rive({ src: 'http://riv.local/file.riv', canvas: document.getElementById('c'), autoplay: false,
    onLoad: () => {
      const c = r.contents;
      window.__r = r;
      res(c);
    }, onLoadError: e => rej(String(e)) });
}));
console.log(JSON.stringify(info.artboards.map(a => ({ name: a.name, sms: a.stateMachines.map(s => s.name + ' [' + s.inputs.map(i => i.name).join(', ') + ']') }))));
// durations from the decoded file
const { loadSchema, decode } = await import('./decode.mjs');
const { objects } = decode(fs.readFileSync(file), loadSchema());
const durs = Object.fromEntries(objects.filter(o => o.type === 'LinearAnimation').map(o => [o.p.name, (o.p.duration ?? 60) / (o.p.fps ?? 60)]));
const names = process.argv.slice(4).length ? process.argv.slice(4) : info.artboards[0].animations;
const N = 8, W = 400, H = 470;
const sheet = await page.evaluate(async ({ names, durs, N, W, H }) => {
  const big = document.createElement('canvas'); big.width = W * N; big.height = (H + 24) * names.length;
  const g = big.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, big.width, big.height); g.font = '600 16px Menlo'; g.fillStyle = '#333';
  for (let row = 0; row < names.length; row++) {
    const name = names[row];
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; document.body.appendChild(cv);
    const r = await new Promise(res => { const x = new rive.Rive({ src: 'http://riv.local/file.riv', canvas: cv, animations: [name], autoplay: false, onLoad: () => res(x) }); });
    for (let k = 0; k < N; k++) {
      const t = durs[name] * k / (N - 1);
      r.scrub(name, t); await new Promise(q => requestAnimationFrame(() => requestAnimationFrame(q)));
      g.drawImage(cv, k * W, row * (H + 24) + 24);
    }
    g.fillStyle = '#333'; g.fillText(`${name}  (${durs[name].toFixed(2)}s)`, 8, row * (H + 24) + 17);
    r.cleanup(); cv.remove();
  }
  return big.toDataURL('image/png');
}, { names, durs, N, W, H });
fs.writeFileSync(out + '_sheet.png', Buffer.from(sheet.split(',')[1], 'base64'));
console.log('wrote', out + '_sheet.png');
await browser.close();
