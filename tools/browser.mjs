// Shared headless Chromium (the one Playwright cached for the badge kit).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

export async function launch() {
  const cache = path.join(process.env.HOME, 'Library/Caches/ms-playwright');
  const dir = fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort().reverse()[0];
  const exe = path.join(cache, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  return chromium.launch({ executablePath: exe });
}

// Render an SVG string to a PNG buffer at `size` px, on white.
export async function renderSvg(browser, svg, size = 2000) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const html = `<html><body style="margin:0;background:#fff">${svg.replace(/<svg([^>]*)width="[^"]*"\s*height="[^"]*"/, `<svg$1width="${size}" height="${size}"`)}</body></html>`;
  await page.setContent(html);
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
  return buf;
}

// Pixel diff of two same-size PNGs. Returns stats + a heatmap PNG (red = mismatch).
export async function diffPng(browser, aBuf, bBuf, threshold = 48) {
  const page = await browser.newPage();
  const res = await page.evaluate(async ({ a, b, threshold }) => {
    const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = ia.width, h = ia.height;
    const c = n => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; };
    const ca = c(), cb = c(), co = c();
    const xa = ca.getContext('2d'), xb = cb.getContext('2d'), xo = co.getContext('2d');
    xa.drawImage(ia, 0, 0); xb.drawImage(ib, 0, 0, w, h);
    const da = xa.getImageData(0, 0, w, h).data, db = xb.getImageData(0, 0, w, h).data;
    const out = xo.createImageData(w, h); let bad = 0, sum = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      sum += d; const g = (da[i] + da[i + 1] + da[i + 2]) / 3 * 0.25 + 190;
      if (d > threshold) { bad++; out.data.set([255, 0, 0, 255], i); } else out.data.set([g, g, g, 255], i);
    }
    xo.putImageData(out, 0, 0);
    return { w, h, badPct: 100 * bad / (w * h), meanDiff: sum / (w * h), heat: co.toDataURL('image/png') };
  }, { a: 'data:image/png;base64,' + aBuf.toString('base64'), b: 'data:image/png;base64,' + bBuf.toString('base64'), threshold });
  await page.close();
  return { ...res, heat: Buffer.from(res.heat.split(',')[1], 'base64') };
}
