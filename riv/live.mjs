// node riv/live.mjs <file.riv> <script.js> — loads the .riv in the official @rive-app/canvas runtime (headless Chromium)
// and runs <script.js> in the page with `window.R` (rive module) and helpers; prints what the script returns.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from '../tools/browser.mjs';
const [, , file, script] = process.argv;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
page.on('console', m => console.log('  [page]', m.text()));
page.on('pageerror', e => console.log('  [pageerror]', e.message));
await page.route('http://riv.local/**', r => {
  const p = new URL(r.request().url()).pathname;
  if (p === '/index.html') return r.fulfill({ body: '<html><body style="margin:0"><canvas id="c" width="393" height="461"></canvas><script src="/rive.js"></script></body></html>', contentType: 'text/html' });
  const f = { '/file.riv': path.resolve(file), '/rive.wasm': path.join(ROOT, 'node_modules/@rive-app/canvas/rive.wasm'), '/rive.js': path.join(ROOT, 'node_modules/@rive-app/canvas/rive.js') }[p];
  f ? r.fulfill({ body: fs.readFileSync(f), contentType: p.endsWith('.wasm') ? 'application/wasm' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }) : r.fulfill({ status: 404 });
});
await page.goto('http://riv.local/index.html');
await page.waitForFunction(() => window.rive);
await page.evaluate(() => rive.RuntimeLoader.setWasmUrl('http://riv.local/rive.wasm'));
const out = await page.evaluate(`(async () => { ${fs.readFileSync(script, 'utf8')} })()`);
if (process.env.SHOTS) { const sh = await page.evaluate(() => window.__shots); for (const [sm, v] of Object.entries(sh)) for (const [l, d] of Object.entries(v.shots)) fs.writeFileSync(path.join(process.env.SHOTS, (sm + "__" + l).replace(/[^\w=]+/g, "_") + ".png"), Buffer.from(d.split(",")[1], "base64")); }
console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
await browser.close();
