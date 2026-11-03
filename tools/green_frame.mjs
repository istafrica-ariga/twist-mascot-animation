// Render the mascot on a flat chroma-green canvas, as the start frame for an image-to-video clip.
// Green is used because none of the character's colours contain it, so keying it back out is clean.
import fs from 'node:fs';
import { launch } from './browser.mjs';

const ROOT = '/Users/ariga/Documents/mascot';
const OUT = process.env.GF_OUT || `${ROOT}/out/masko_redo/green_start.png`;
const W = 1080, H = 1920;
const GREEN = '#00B140';                 // broadcast chroma green, far from every character colour
const SCALE = Number(process.env.GF_SCALE || 0.52);   // mascot width as a fraction of the canvas
const CY = Number(process.env.GF_CY || 0.62);         // vertical centre as a fraction of the canvas

const svg = fs.readFileSync(`${ROOT}/rig3/stand_composite.svg`, 'utf8');
const side = W * SCALE;

const html = `<!doctype html><meta charset="utf-8"><style>
  html,body { margin:0; padding:0; background:${GREEN} }
  body { width:${W}px; height:${H}px; position:relative; overflow:hidden }
  #m { position:absolute; left:50%; top:${CY * 100}%; transform:translate(-50%,-50%);
       width:${side}px; height:${side}px }
  #m svg { width:100%; height:100%; display:block }
</style><div id="m">${svg}</div>`;

const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(html);
await page.screenshot({ path: OUT });
await browser.close();
console.log('wrote', OUT);
