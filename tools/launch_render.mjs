// Render the launch film. `--sheet` writes a few key frames for review; otherwise the full MP4.
//   node tools/launch_render.mjs --sheet
//   node tools/launch_render.mjs            → out/launch/twist_launch.mp4
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch } from './browser.mjs';
import { frame, W, H, FPS, DUR, NFRAMES } from './launch_scene.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'out/launch');
const AUDIO = process.env.LAUNCH_AUDIO || '/Users/ariga/Downloads/My_session_98443_Topaz_Upscale_Video.mp4';
const sheet = process.argv.includes('--sheet');

fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });

const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(`<html><body style="margin:0;background:#000"><div id="s"></div></body></html>`);

const shoot = async (t, file) => {
  await page.evaluate(svg => { document.getElementById('s').innerHTML = svg; }, frame(t));
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: W, height: H } });
};

if (sheet) {
  const times = [0.05, 0.22, 0.40, 0.70, 1.25, 2.60];
  for (const [i, t] of times.entries()) await shoot(t, path.join(OUT, `key_${i}_${t}.png`));
  // one contact sheet so the beats can be read side by side
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-pattern_type', 'glob', '-i', path.join(OUT, 'key_*.png'),
    '-filter_complex', `scale=300:-1,tile=6x1`, '-frames:v', '1', path.join(OUT, 'keysheet.png')]);
  console.log('key frames + keysheet.png →', OUT);
} else {
  const t0 = Date.now();
  for (let i = 0; i < NFRAMES; i++) {
    await shoot(i / FPS, path.join(OUT, 'frames', String(i).padStart(4, '0') + '.png'));
    if (i % 20 === 0) process.stdout.write(`\r  frame ${i}/${NFRAMES}`);
  }
  console.log(`\r  ${NFRAMES} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const mp4 = path.join(OUT, 'twist_launch.mp4');
  const args = ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(OUT, 'frames/%04d.png')];
  const hasAudio = fs.existsSync(AUDIO);
  if (hasAudio) args.push('-i', AUDIO, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '160k', '-shortest');
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-movflags', '+faststart', mp4);
  execFileSync('ffmpeg', args);

  // a silent webm too — small enough to drop straight into a splash screen
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(OUT, 'frames/%04d.png'),
    '-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-an', path.join(OUT, 'twist_launch.webm')]);

  const kb = f => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
  console.log(`  ${mp4}  ${kb(mp4)}${hasAudio ? '  (with the reference audio track)' : '  (no audio source found)'}`);
  console.log(`  ${path.join(OUT, 'twist_launch.webm')}  ${kb(path.join(OUT, 'twist_launch.webm'))}`);
}

await browser.close();
