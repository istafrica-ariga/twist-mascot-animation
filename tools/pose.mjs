// node tools/pose.mjs → check/poses.png : the layered SVG in test poses (rigid rotations about the rig pivots in
// parts/spec.mjs, children follow parents), to check that moving parts reveal finished art, not holes.
import fs from 'node:fs';
import { launch } from './browser.mjs';
import { rig } from '../parts/spec.mjs';

export const POSES = {
  rest: {},
  'head + ears': { head: { r: 9, y: -16 }, ear_L: { r: -16 }, ear_R: { r: 18 } },
  'legs + right arm': { leg_L: { r: 24 }, leg_R: { r: -20 }, arm_R_upper: { r: -14 }, hand_R: { r: 24 } },
  'fist + capes': { arm_L: { r: -14 }, hand_L: { r: 28 }, head: { r: -8 }, cape_L: { r: 10 }, cape_R: { r: -10 } },
};

export function transformFor(id, pose) {
  const chain = [];
  for (let p = id; p; p = rig[p]?.parent) chain.unshift(p);
  return chain.map(p => {
    const t = pose[p]; if (!t) return '';
    const [cx, cy] = rig[p].pivot || [0, 0];
    return `translate(${t.x || 0} ${t.y || 0}) rotate(${t.r || 0} ${cx} ${cy})`;
  }).join(' ');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const svg = fs.readFileSync(new URL('../out/mascot_parts.svg', import.meta.url), 'utf8');
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 2400, height: 760 } });
  const cells = Object.entries(POSES).map(([name, pose]) => {
    const posed = svg.replace(/<g id="([a-z_LR]+)">/g, (m, id) => `<g id="${id}" transform="${transformFor(id, pose)}">`)
      .replace('width="1254" height="1254" viewBox="0 0 1254 1254"', 'width="600" height="700" viewBox="170 60 920 1070"');
    return `<div style="display:inline-block;text-align:center;font:600 22px Menlo">${posed}<div>${name}</div></div>`;
  });
  await page.setContent(`<body style="margin:0;background:#fff;white-space:nowrap">${cells.join('')}</body>`);
  await page.screenshot({ path: new URL('../check/poses.png', import.meta.url).pathname });
  await browser.close();
}
