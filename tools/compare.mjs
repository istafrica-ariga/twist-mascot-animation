// node tools/compare.mjs <a.svg|png> <b.svg|png> <outPrefix>
// Renders both at 2000px, writes <outPrefix>_a.png, _b.png, _diff.png and prints mismatch stats.
import fs from 'node:fs';
import { launch, renderSvg, diffPng } from './browser.mjs';

const [, , a, b, out] = process.argv;
const browser = await launch();
const load = async f => f.endsWith('.svg') ? renderSvg(browser, fs.readFileSync(f, 'utf8')) : fs.readFileSync(f);
const [ra, rb] = [await load(a), await load(b)];
fs.writeFileSync(out + '_a.png', ra); fs.writeFileSync(out + '_b.png', rb);
const d = await diffPng(browser, ra, rb);
fs.writeFileSync(out + '_diff.png', d.heat);
console.log(`${a} vs ${b}: ${d.badPct.toFixed(3)}% pixels differ, mean Δ ${d.meanDiff.toFixed(2)}/255`);
await browser.close();
