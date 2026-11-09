// Render the lesson mascot's poses straight out of the Rive file, on chroma green.
//
//   node lesson/poses.mjs <file.riv>
//
// These become the start/end frames for the video model. Taking them from the rig rather than
// generating them means the character is EXACTLY right — it is the same artwork the app ships,
// not a re-interpretation — and it costs nothing.
//
// Green because none of the character's colours are near it, so it keys back out cleanly; white
// would punch holes in the eyes and teeth.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from '../tools/browser.mjs';

const file = process.argv[2];
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = `${ROOT}/lesson/poses`;
fs.mkdirSync(OUT, { recursive: true });

const W = 1080, H = 1080;
const GREEN = '#09ae4f';     // same key colour the splash pipeline used

// animation, fraction through its work area, output name
const POSES = [
  ['Breathing', 0.00, 'idle'],
  ['Thinking', 0.60, 'thinking'],
  ['Celebration', 0.45, 'celebrate'],
  ['Celebration 4', 0.50, 'celebrate_big'],
  ['Frustrated', 0.55, 'console'],
];

const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.route('http://riv.local/**', r => {
  const p = decodeURIComponent(new URL(r.request().url()).pathname);
  if (p === '/index.html') {
    return r.fulfill({
      contentType: 'text/html',
      body: `<html><body style="margin:0;background:${GREEN}">
        <canvas id="c" width="${W}" height="${H}"></canvas>
        <script src="/rive.js"></script></body></html>`,
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

for (const [anim, frac, name] of POSES) {
  const ok = await page.evaluate(({ anim, frac }) => new Promise((resolve) => {
    if (window.__r) { try { window.__r.cleanup(); } catch (e) { /* first run */ } }
    const r = new window.rive.Rive({
      src: '/file.riv',
      canvas: document.getElementById('c'),
      artboard: 'Artboard 3',
      animations: anim,
      autoplay: true,
      layout: new window.rive.Layout({ fit: 'contain' }),
      onLoad: () => {
        window.__r = r;
        // Let it play to the requested point, then stop on that frame. scrub() is the documented
        // way to park a linear animation at a position without it advancing underneath us.
        r.pause();
        try { r.scrub(anim, frac); } catch (e) { /* fall back to the first frame */ }
        setTimeout(() => resolve(true), 120);
      },
      onLoadError: (e) => resolve(String(e)),
    });
  }), { anim, frac });

  if (ok !== true) { console.error(`  ${name}: ${ok}`); continue; }
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${name.padEnd(14)} <- ${anim} @ ${(frac * 100).toFixed(0)}%`);
}

await browser.close();
if (errors.length) console.error('page errors:', errors.join(' | '));
console.log(`\nwrote ${OUT}/`);
