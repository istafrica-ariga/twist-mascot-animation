// Drive the lesson Reaction state machine in the real Rive runtime and capture what it does.
//
//   node lesson/drive.mjs <file.riv>
//
// Proof, not description: it fires the same inputs the app will fire, screenshots the canvas on a
// schedule, and writes a labelled contact sheet. The interesting frame is the one where a reaction
// interrupts Thinking mid-play — that is the thing Masko's player structurally cannot do, because
// there a move waits for the clip on screen to end.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from '../tools/browser.mjs';

const file = process.argv[2];
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = `${ROOT}/lesson/out`;
fs.mkdirSync(OUT, { recursive: true });

const W = 420, H = 420;

// (label, delay before shooting in ms, action to run first)
//
// The delays are chosen from the measured state log, not guessed. The takes are very different
// lengths — Celebration and Celebration 4 run ~1350 ms (work area 80 frames) but Frustrated runs
// only ~350 ms (work area 20). An even sampling interval misses the short one entirely and makes
// a working transition look like a dead one.
const SCRIPT = [
  ['idle', 600, null],
  ['correct, streak 1', 360, `i.streak.value = 1; i.correct.fire()`],
  ['yes', 520, null],
  ['back to idle', 900, null],
  ['wrong', 170, `i.wrong.fire()`],
  ['oops', 190, null],
  ['chain: go_on', 330, null],
  ['go_on holding', 260, null],
  ['idle again', 800, null],
  ['correct, streak 6', 420, `i.streak.value = 6; i.correct.fire()`],
  ['yes_big', 520, null],
];

const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.route('http://riv.local/**', r => {
  const p = decodeURIComponent(new URL(r.request().url()).pathname);
  if (p === '/index.html') {
    return r.fulfill({
      contentType: 'text/html',
      body: `<html><body style="margin:0;background:#fff">
        <canvas id="c" width="${W}" height="${H}"></canvas>
        <script src="/rive.js"></script></body></html>`,
    });
  }
  const f = p === '/file.riv' ? path.resolve(file)
    : p === '/rive.wasm' ? `${ROOT}/node_modules/@rive-app/canvas/rive.wasm`
      : p === '/rive.js' ? `${ROOT}/node_modules/@rive-app/canvas/rive.js` : null;
  if (!f) return r.abort();
  return r.fulfill({ body: fs.readFileSync(f), contentType: p.endsWith('.wasm') ? 'application/wasm' : 'application/javascript' });
});

await page.goto('http://riv.local/index.html');

const ready = await page.evaluate(() => new Promise((resolve) => {
  const r = new window.rive.Rive({
    src: '/file.riv',
    canvas: document.getElementById('c'),
    artboard: 'Artboard 3',
    stateMachines: 'State Machine 1',
    autoplay: true,
    layout: new window.rive.Layout({ fit: 'contain' }),
    onStateChange: (e) => {
      // The definitive record of what the machine did. Reading it off the pixels is guesswork:
      // an animation with a short work area can finish between two screenshots and look like
      // nothing happened at all.
      (window.__log ||= []).push({ t: Math.round(performance.now()), states: e.data });
    },
    onLoad: () => {
      window.__r = r;
      const list = r.stateMachineInputs('State Machine 1');
      window.__i = Object.fromEntries(list.map(x => [x.name, x]));
      window.__t0 = performance.now();
      resolve({ inputs: list.map(x => x.name), artboards: r.contents?.artboards?.map(a => a.name) });
    },
    onLoadError: (e) => resolve({ error: String(e) }),
  });
}));

if (ready.error) { console.error('load failed:', ready.error); await browser.close(); process.exit(1); }
console.log('inputs found:', ready.inputs.join(', '));

const shots = [];
for (const [label, wait, action] of SCRIPT) {
  if (action) await page.evaluate(`(() => { const i = window.__i; ${action}; })()`);
  await page.waitForTimeout(wait);
  const f = path.join(OUT, `f${String(shots.length).padStart(2, '0')}.png`);
  await page.screenshot({ path: f });
  shots.push({ label, f });
  console.log(`  ${String(shots.length).padStart(2)}  ${label}`);
}

const log = await page.evaluate(() => (window.__log || []).map(e => ({ t: e.t - window.__t0, states: e.states })));
console.log('\nstate changes reported by the runtime:');
if (!log.length) console.log('  (none)');
for (const e of log) console.log(`  ${String(Math.round(e.t)).padStart(5)} ms   ${e.states.join(', ')}`);

await browser.close();
if (errors.length) console.error('page errors:', errors.join(' | '));

// contact sheet
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#15052E;font-family:-apple-system,"SF Pro Text",sans-serif;padding:22px}
  h1{color:#fff;font-size:19px;margin:0 0 3px}
  p{color:#B9A6E8;font-size:13px;margin:0 0 18px}
  .row{display:flex;gap:9px;flex-wrap:wrap}
  .c{width:176px}
  .c img{width:100%;border-radius:8px;display:block;background:#fff}
  .c div{color:#C9B8F0;font-size:11.5px;margin-top:6px;text-align:center;letter-spacing:.2px}
</style>
<h1>Lesson reactions — driven in the Rive runtime</h1>
<p>The same inputs the app will fire, captured as they happen.</p>
<div class="row">${shots.map((s, k) => `<div class="c"><img src="${b64(s.f)}"><div>${k + 1}. ${s.label}</div></div>`).join('')}</div>`;

const b2 = await launch();
const p2 = await b2.newPage({ viewport: { width: 1180, height: 900 } });
await p2.setContent(html);
await p2.screenshot({ path: `${OUT}/reactions.png`, fullPage: true });
await b2.close();
console.log(`\nwrote ${OUT}/reactions.png`);
