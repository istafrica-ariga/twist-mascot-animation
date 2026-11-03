// node rig3/anim.mjs [stills…]   stills: "<animation>@<seconds>" → check/rig3_sheet.png (no stills: state-machine video)
// Video: plays the state machine like the app: stand … launch @1.2 s … fly … land @4.3 s … stand, 30 fps, 6 s
//   → check/mascot3_anim.mp4 + check/mascot3_anim_sheet.png
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch } from '../tools/browser.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const esb = path.join(ROOT, 'node_modules/.bin/esbuild');
fs.writeFileSync(path.join(ROOT, 'rig3/.entry.ts'), `import { buildMascot3 } from './mascot3';\nimport fs from 'node:fs';\nfs.writeFileSync(process.argv[2], JSON.stringify(buildMascot3()));\n`);
execFileSync(esb, [path.join(ROOT, 'rig3/.entry.ts'), '--bundle', '--platform=node', '--format=esm', '--outfile=' + path.join(ROOT, 'rig3/.build.mjs'), '--log-level=warning']);
execFileSync('node', [path.join(ROOT, 'rig3/.build.mjs'), path.join(ROOT, 'rig3/mascot3.rig.json')]);
execFileSync(esb, [path.join(ROOT, 'twist-rig/test/browser-entry.ts'), '--bundle', '--format=iife', '--outfile=' + path.join(ROOT, 'twist-rig/test/dist/bundle.js'), '--log-level=warning']);
const built = JSON.parse(fs.readFileSync(path.join(ROOT, 'rig3/mascot3.rig.json'), 'utf8'));
console.log(`${built.model.components.length} components, ${(fs.statSync(path.join(ROOT, 'rig3/mascot3.rig.json')).size / 1024).toFixed(0)} KB`);

const stills = process.argv.slice(2);
const FPS = 30, SECONDS = 6, SIZE = 720, EVENTS = [[1.2, 'launch'], [4.3, 'land']];
const browser = await launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
page.on('pageerror', e => console.log('  [pageerror]', e.message));
page.on('console', m => console.log('  [page]', m.text()));
await page.addScriptTag({ path: path.join(ROOT, 'twist-rig/test/dist/bundle.js') });
const res = await page.evaluate(({ built, FPS, SECONDS, SIZE, EVENTS, stills }) => {
  const { compileRig, createPose, resetPose, solve, displayList, drawCanvas2D, applyAnimation, createSM, setInput, advanceSM } = window.TwistRig;
  const rig = compileRig(built.model), pose = createPose(rig);
  // frame: art x 40..1214, y -110..1064
  const s = SIZE / 1174, view = [s, 0, 0, s, -40 * s, 110 * s];
  const cv = document.createElement('canvas'); cv.width = cv.height = SIZE; const ctx = cv.getContext('2d');
  const bg = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); const g = ctx.createLinearGradient(0, 0, 0, SIZE); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#F3EDFF'); ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE); };
  const out = [], log = [];
  if (stills.length) {
    for (const f of stills) {
      const [a, t] = f.split('@'); resetPose(rig, pose); applyAnimation(rig, pose, rig.animations.find(x => x.name === a), +t); solve(rig, pose);
      bg(); drawCanvas2D(ctx, displayList(rig, pose, view)); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#888'; ctx.font = '600 20px Menlo'; ctx.fillText(f, 12, 28);
      out.push(cv.toDataURL('image/png'));
    }
    return { out, log };
  }
  const sm = createSM(built.stateMachine); let ev = 0;
  for (let k = 0; k < FPS * SECONDS; k++) {
    const t = k / FPS;
    while (ev < EVENTS.length && t >= EVENTS[ev][0]) { setInput(sm, EVENTS[ev][1]); log.push(`${t.toFixed(2)}s fire ${EVENTS[ev][1]}`); ev++; }
    resetPose(rig, pose); advanceSM(rig, pose, built.stateMachine, sm, k ? 1 / FPS : 0); solve(rig, pose);
    if (sm.events.length) log.push(`${t.toFixed(2)}s → ${sm.events.splice(0).join(', ')}`);
    bg(); drawCanvas2D(ctx, displayList(rig, pose, view));
    out.push(cv.toDataURL('image/png'));
  }
  return { out, log };
}, { built, FPS, SECONDS, SIZE, EVENTS, stills });
await browser.close();
if (res.log.length) console.log(res.log.join('\n'));
const dir = path.join(ROOT, stills.length ? 'check/rig3_stills' : 'check/anim3');
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
res.out.forEach((d, k) => fs.writeFileSync(path.join(dir, `f${String(k).padStart(4, '0')}.png`), Buffer.from(d.split(',')[1], 'base64')));
if (stills.length) {
  const cols = Math.min(stills.length, 4), rows = Math.ceil(stills.length / cols);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, 'f%04d.png'), '-vf', `scale=360:-1,tile=${cols}x${rows}`, '-frames:v', '1', path.join(ROOT, 'check/rig3_sheet.png')]);
  console.log('→ check/rig3_sheet.png');
} else {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', path.join(ROOT, 'check/mascot3_anim.mp4')]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, 'f%04d.png'), '-vf', `select='not(mod(n\\,6))',scale=180:-1,tile=10x3`, '-frames:v', '1', path.join(ROOT, 'check/mascot3_anim_sheet.png')]);
  console.log('→ check/mascot3_anim.mp4, check/mascot3_anim_sheet.png');
}
