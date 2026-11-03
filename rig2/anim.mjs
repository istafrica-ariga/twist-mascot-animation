// node rig/anim.mjs → plays the mascot's state machine like the app would and records it.
//   timeline: stand … fire('launch') @1.2 s … fly … fire('land') @4.3 s … stand, 30 fps, 6 s
//   → check/mascot2_anim.mp4 + check/mascot2_anim_sheet.png
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch } from '../tools/browser.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const esb = path.join(ROOT, 'node_modules/.bin/esbuild');
execFileSync(esb, [path.join(ROOT, 'rig2/.entry.ts'), '--bundle', '--platform=node', '--format=esm', '--outfile=' + path.join(ROOT, 'rig2/.build.mjs'), '--log-level=warning']);
execFileSync('node', [path.join(ROOT, 'rig2/.build.mjs'), path.join(ROOT, 'rig2/mascot2.rig.json')]);
execFileSync(esb, [path.join(ROOT, 'twist-rig/test/browser-entry.ts'), '--bundle', '--format=iife', '--outfile=' + path.join(ROOT, 'twist-rig/test/dist/bundle.js'), '--log-level=warning']);
const built = JSON.parse(fs.readFileSync(path.join(ROOT, 'rig2/mascot2.rig.json'), 'utf8'));

const FPS = 30, SECONDS = 6, SIZE = 720;
const EVENTS = [[1.2, 'launch'], [4.3, 'land']];
const dir = path.join(ROOT, 'check/anim2');
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
page.on('pageerror', e => console.log('  [pageerror]', e.message));
await page.addScriptTag({ path: path.join(ROOT, 'twist-rig/test/dist/bundle.js') });
const frames = await page.evaluate(({ built, FPS, SECONDS, SIZE, EVENTS }) => {
  const { compileRig, createPose, resetPose, solve, displayList, drawCanvas2D, createSM, setInput, advanceSM } = window.TwistRig;
  const rig = compileRig(built.model), pose = createPose(rig), sm = createSM(built.stateMachine);
  // frame: art x 117..1137, y -220..1300 (room above for the flight, ground + shadow below)
  const s = SIZE / 1520, view = [s, 0, 0, s, -117 * s + (SIZE - 1020 * s) / 2, 220 * s];
  const cv = document.createElement('canvas'); cv.width = cv.height = SIZE; const ctx = cv.getContext('2d');
  const out = [], log = [];
  let ev = 0;
  for (let k = 0; k < FPS * SECONDS; k++) {
    const t = k / FPS;
    while (ev < EVENTS.length && t >= EVENTS[ev][0]) { setInput(sm, EVENTS[ev][1]); log.push(`${t.toFixed(2)}s fire ${EVENTS[ev][1]}`); ev++; }
    resetPose(rig, pose); advanceSM(rig, pose, built.stateMachine, sm, k ? 1 / FPS : 0); solve(rig, pose);
    if (sm.events.length) log.push(`${t.toFixed(2)}s → ${sm.events.splice(0).join(', ')}`);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#8B48F0'; ctx.fillRect(0, 0, SIZE, SIZE);
    const g = ctx.createLinearGradient(0, 0, 0, SIZE); g.addColorStop(0, '#9550F2'); g.addColorStop(1, '#7E3FE8'); ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
    drawCanvas2D(ctx, displayList(rig, pose, view));
    out.push(cv.toDataURL('image/png'));
  }
  return { out, log };
}, { built, FPS, SECONDS, SIZE, EVENTS });
frames.out.forEach((d, k) => fs.writeFileSync(path.join(dir, `f${String(k).padStart(4, '0')}.png`), Buffer.from(d.split(',')[1], 'base64')));
console.log(frames.log.join('\n'));
await browser.close();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', path.join(ROOT, 'check/mascot2_anim.mp4')]);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, 'f%04d.png'), '-vf', `select='not(mod(n\\,10))',scale=240:-1,tile=6x3`, '-frames:v', '1', path.join(ROOT, 'check/mascot2_anim_sheet.png')]);
console.log('→ check/mascot2_anim.mp4, check/mascot2_anim_sheet.png');
