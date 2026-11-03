// node rig/render.mjs [pose.json] → builds the mascot rig, renders it with twist-rig (Canvas 2D) in headless Chromium.
//   rest pose → check/rig_rest.png + diff vs ref/mascot_original.png (check/rig_rest_diff.png)
//   with a pose file ({ bones: { name: { rotation?, length?, scaleX?, … } } } in radians) → check/rig_pose.png
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch, diffPng } from '../tools/browser.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const esb = path.join(ROOT, 'node_modules/.bin/esbuild');
// build the model in node (builder is plain TS)
fs.writeFileSync(path.join(ROOT, 'rig/.build-entry.ts'), `import { buildMascot } from './mascot';\nimport fs from 'node:fs';\nconst r = buildMascot();\nfs.writeFileSync(process.argv[2], JSON.stringify(r));\n`);
execFileSync(esb, [path.join(ROOT, 'rig/.build-entry.ts'), '--bundle', '--platform=node', '--format=esm', '--outfile=' + path.join(ROOT, 'rig/.build.mjs'), '--log-level=warning']);
execFileSync('node', [path.join(ROOT, 'rig/.build.mjs'), path.join(ROOT, 'rig/mascot.rig.json')]);
const built = JSON.parse(fs.readFileSync(path.join(ROOT, 'rig/mascot.rig.json'), 'utf8'));
execFileSync(esb, [path.join(ROOT, 'twist-rig/test/browser-entry.ts'), '--bundle', '--format=iife', '--outfile=' + path.join(ROOT, 'twist-rig/test/dist/bundle.js'), '--log-level=warning']);

const poseFile = process.argv[2];
// "anim:<name>@<seconds>" renders a rig animation at a time; otherwise a pose JSON file
const poseSpec = !poseFile ? null : poseFile.startsWith('anim:') ? { anim: poseFile.slice(5).split('@')[0], t: +(poseFile.split('@')[1] || 0) } : JSON.parse(fs.readFileSync(poseFile, 'utf8'));
const S = 2000 / 1254;
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 2000, height: 2000 } });
page.on('pageerror', e => console.log('  [pageerror]', e.message));
await page.addScriptTag({ path: path.join(ROOT, 'twist-rig/test/dist/bundle.js') });
const png = await page.evaluate(({ built, S, poseSpec }) => {
  const { compileRig, createPose, resetPose, solve, displayList, drawCanvas2D } = window.TwistRig;
  const rig = compileRig(built.model), pose = createPose(rig);
  resetPose(rig, pose);
  // pose: { bones: { name: { drot: degrees added to rotation, lenScale, …absolute props } } }
  if (poseSpec && !poseSpec.anim) for (const [name, props] of Object.entries(poseSpec.bones || {})) {
    const p = pose.p[built.bones[name]];
    for (const [k, v] of Object.entries(props)) {
      if (k === 'drot') p.rotation = (p.rotation ?? 0) + v * Math.PI / 180;
      else if (k === 'lenScale') p.length = (p.length ?? 0) * v;
      else p[k] = v;
    }
  }
  if (poseSpec && poseSpec.anim) window.TwistRig.applyAnimation(rig, pose, rig.animations.find(a => a.name === poseSpec.anim), poseSpec.t);
  solve(rig, pose);
  const cv = document.createElement('canvas'); cv.width = cv.height = 2000;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 2000, 2000);
  drawCanvas2D(ctx, displayList(rig, pose, [S, 0, 0, S, 0, 0]));
  return cv.toDataURL('image/png');
}, { built, S, poseSpec });
const buf = Buffer.from(png.split(',')[1], 'base64');
const out = path.join(ROOT, 'check', poseSpec ? `rig_pose_${path.basename(poseFile, '.json').replace(/\W+/g, '_')}.png` : 'rig_rest.png');
fs.writeFileSync(out, buf);
if (!poseSpec) {
  const d = await diffPng(browser, buf, fs.readFileSync(path.join(ROOT, 'ref/mascot_original.png')));
  fs.writeFileSync(path.join(ROOT, 'check/rig_rest_diff.png'), d.heat);
  console.log(`rest pose vs original: ${d.badPct.toFixed(2)}% pixels differ (mean Δ ${d.meanDiff.toFixed(2)})`);
}
console.log('→', out, `· ${built.model.components.length} components`);
await browser.close();
