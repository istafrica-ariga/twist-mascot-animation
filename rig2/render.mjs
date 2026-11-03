// node rig2/render.mjs [frames…]   frames: "neutral" | "<animation>@<seconds>"  (default: neutral stand@0 fly@0)
// Builds rig2/mascot2.ts and renders each frame with twist-rig → check/rig2_<frame>.png + check/rig2_sheet.png
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch } from '../tools/browser.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const esb = path.join(ROOT, 'node_modules/.bin/esbuild');
fs.writeFileSync(path.join(ROOT, 'rig2/.entry.ts'), `import { buildMascot2 } from './mascot2';\nimport fs from 'node:fs';\nfs.writeFileSync(process.argv[2], JSON.stringify(buildMascot2()));\n`);
execFileSync(esb, [path.join(ROOT, 'rig2/.entry.ts'), '--bundle', '--platform=node', '--format=esm', '--outfile=' + path.join(ROOT, 'rig2/.build.mjs'), '--log-level=warning']);
execFileSync('node', [path.join(ROOT, 'rig2/.build.mjs'), path.join(ROOT, 'rig2/mascot2.rig.json')]);
execFileSync(esb, [path.join(ROOT, 'twist-rig/test/browser-entry.ts'), '--bundle', '--format=iife', '--outfile=' + path.join(ROOT, 'twist-rig/test/dist/bundle.js'), '--log-level=warning']);
const built = JSON.parse(fs.readFileSync(path.join(ROOT, 'rig2/mascot2.rig.json'), 'utf8'));
const frames = process.argv.slice(2).length ? process.argv.slice(2) : ['neutral', 'stand@0', 'fly@0'];
const SIZE = 900;
const browser = await launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
page.on('pageerror', e => console.log('  [pageerror]', e.message));
await page.addScriptTag({ path: path.join(ROOT, 'twist-rig/test/dist/bundle.js') });
const pngs = await page.evaluate(({ built, frames, SIZE }) => {
  const { compileRig, createPose, resetPose, solve, displayList, drawCanvas2D, applyAnimation } = window.TwistRig;
  const rig = compileRig(built.model), pose = createPose(rig);
  const s = SIZE / 1300, view = [s, 0, 0, s, -(627 - 650) * s, 80 * s - 120 * s];
  return frames.map(f => {
    resetPose(rig, pose);
    if (f !== 'neutral') { const [a, t] = f.split('@'); applyAnimation(rig, pose, rig.animations.find(x => x.name === a), +t); }
    solve(rig, pose);
    const cv = document.createElement('canvas'); cv.width = cv.height = SIZE; const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, SIZE, SIZE);
    drawCanvas2D(ctx, displayList(rig, pose, view));
    ctx.fillStyle = '#888'; ctx.font = '600 22px Menlo'; ctx.fillText(f, 16, 32);
    return cv.toDataURL('image/png');
  });
}, { built, frames, SIZE });
const files = pngs.map((d, i) => { const f = path.join(ROOT, 'check', `rig2_${frames[i].replace(/\W+/g, '_')}.png`); fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); return f; });
await browser.close();
const args = files.flatMap(f => ['-i', f]);
execFileSync('ffmpeg', ['-v', 'error', '-y', ...args, '-filter_complex', `${files.map((_, i) => `[${i}]scale=480:-1[v${i}]`).join(';')};${files.map((_, i) => `[v${i}]`).join('')}hstack=${files.length}`, path.join(ROOT, 'check/rig2_sheet.png')]);
console.log(`${built.model.components.length} components → check/rig2_sheet.png`);
