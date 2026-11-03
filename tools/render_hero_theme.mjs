// Render the hero theme and its haptics headlessly.
import fs from 'node:fs';
import { launch } from './browser.mjs';

const ROOT = '/Users/ariga/Documents/mascot';
const OUT = `${ROOT}/out/masko_redo/audio`;
fs.mkdirSync(OUT, { recursive: true });

const browser = await launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`file://${ROOT}/tools/hero_theme.html`, { waitUntil: 'load' });

const b64 = await page.evaluate(() => window.renderAudio(4.2));
if (!b64) throw new Error('renderAudio returned nothing' + (errors.length ? `: ${errors[0]}` : ''));
fs.writeFileSync(`${OUT}/hero_theme.wav`, Buffer.from(b64, 'base64'));

const h = await page.evaluate(() => window.haptics('twist_launch.wav'));
fs.writeFileSync(`${OUT}/twist_launch.ahap`, JSON.stringify(h.ahap, null, 2) + '\n');
fs.writeFileSync(`${OUT}/twist_launch.android.json`, JSON.stringify(h.android, null, 2) + '\n');
await browser.close();

if (errors.length) console.error('page errors:\n ', errors.join('\n  '));
const kb = f => (fs.statSync(`${OUT}/${f}`).size / 1024).toFixed(0);
console.log(`hero_theme.wav  ${kb('hero_theme.wav')} KB`);
console.log(`twist_launch.ahap  ${kb('twist_launch.ahap')} KB  (${h.events.length} haptic events)`);
