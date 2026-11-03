// Render the launch cue sheet to a WAV and an AHAP, headlessly.
//
// The sound is authored in tools/launch_sound.html using the badge kit's Web Audio engine, so this
// just drives OfflineAudioContext in a real browser and writes what comes back. The same cue sheet
// produces the haptics, which is why the two can never drift apart.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './browser.mjs';

const ROOT = '/Users/ariga/Documents/mascot';
const OUT = `${ROOT}/out/masko_redo/audio`;
const PAGE = `file://${ROOT}/tools/launch_sound.html`;
const END = 4.10;

fs.mkdirSync(OUT, { recursive: true });

const browser = await launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(PAGE, { waitUntil: 'load' });

const b64 = await page.evaluate(end => window.renderAudio(0, end), END);
if (!b64) throw new Error('renderAudio returned nothing' + (errors.length ? `: ${errors[0]}` : ''));
fs.writeFileSync(`${OUT}/launch_stereo.wav`, Buffer.from(b64, 'base64'));

const h = await page.evaluate(() => window.launchHaptics('twist_launch.wav'));
fs.writeFileSync(`${OUT}/twist_launch.ahap`, JSON.stringify(h.ahap, null, 2) + '\n');
fs.writeFileSync(`${OUT}/twist_launch.android.json`, JSON.stringify(h.android, null, 2) + '\n');
fs.writeFileSync(`${OUT}/twist_launch.web.json`, JSON.stringify({ pattern: h.web }, null, 2) + '\n');

const cues = await page.evaluate(() => window.CUES.map(c => ({ t: c.t, sound: c.sound, haptics: (c.haptic || []).length })));
await browser.close();

if (errors.length) console.error('page errors:', errors.join('\n'));

const kb = f => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0);
console.log(`wrote ${OUT}/`);
console.log(`  launch_stereo.wav          ${kb('launch_stereo.wav')} KB`);
console.log(`  twist_launch.ahap          ${kb('twist_launch.ahap')} KB  (${h.events.length} haptic events)`);
console.log(`  twist_launch.android.json  ${kb('twist_launch.android.json')} KB`);
console.log(`  twist_launch.web.json      ${kb('twist_launch.web.json')} KB`);
console.log('\ncue sheet');
for (const c of cues) console.log(`  ${c.t.toFixed(2)}s  ${c.sound.padEnd(8)} ${c.haptics} haptic${c.haptics === 1 ? '' : 's'}`);
