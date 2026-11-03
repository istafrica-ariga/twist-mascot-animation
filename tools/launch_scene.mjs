// The 4-second Twist launch, built to out/launch/SPEC.md (not to the reference video, which
// misses the spec's timing by ~0.9 s). Beats, overshoot and part lag all come from the brief.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export const W = 1080, H = 1920, FPS = 30, DUR = 4.0;

// --- the mascot's own parts -------------------------------------------------
// The WHOLE element is kept: the mirrored variants carry their own transform on the <g>.
const readParts = file => {
  const s = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const parts = {};
  const open = /<g id="([^"]+)"[^>]*>/g;
  let m;
  while ((m = open.exec(s))) {
    let depth = 1;
    const tag = /<g\b[^>]*>|<\/g>/g;
    tag.lastIndex = open.lastIndex;
    let t;
    while (depth && (t = tag.exec(s))) depth += t[0] === '</g>' ? -1 : 1;
    parts[m[1]] = s.slice(m.index, tag.lastIndex);
    open.lastIndex = tag.lastIndex;
  }
  return parts;
};

const base = readParts('out/mascot_parts.svg');
const vars = readParts('out/mascot_variants.svg');

// Draw order, back to front. SPEC: cape behind everything; never reordered.
const ORDER = ['cape_L', 'cape_R', 'cape_mid', 'leg_L', 'leg_R', 'torso', 'arm_R_upper', 'hand_R',
  'collar', 'arm_L', 'hand_L', 'ear_L', 'ear_R', 'head', 'eye_L', 'eye_R',
  'blush_L', 'blush_R', 'nose', 'mouth', 'medal'];

// Which parts lag behind the root, and by how much per unit of root velocity.
// SPEC: head 1-2 px, legs 2-3 px, cape most. Hierarchy = torso -> limbs -> cape.
const LAG = {
  cape_L: 0.0085, cape_R: 0.0085, cape_mid: 0.0085,
  leg_L: 0.0010, leg_R: 0.0012,                     // one leg trails slightly lower
  arm_L: 0.0012, hand_L: 0.0013, arm_R_upper: 0.0011, hand_R: 0.0012,
  ear_L: 0.0006, ear_R: 0.0006, head: 0.0006, eye_L: 0.0006, eye_R: 0.0006,
  blush_L: 0.0006, blush_R: 0.0006, nose: 0.0006, mouth: 0.0006,
};

const STAND = { arm_L: 'arm_L_stand', hand_L: 'hand_L_stand', leg_L: 'leg_L_stand', mouth: 'mouth_closed' };

const ART = 1254, CX = 627;
const CAPE_PIVOT = [627, 596];

// --- easing -----------------------------------------------------------------
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const inv = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const outCubic = u => 1 - (1 - u) ** 3;
const outQuart = u => 1 - (1 - u) ** 4;
const inOut = u => u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;

// --- beats (seconds), straight from SPEC.md ---------------------------------
const T = {
  empty: 0.10, antic: 0.25, takeoff: 0.55, ascent: 0.95, decel: 1.15,
  over: 1.25, overHold: 1.35, settled: 1.60,
  word: 1.85, wordEnd: 2.15, powered: 2.00, poweredEnd: 2.25, accent: 2.15, accentEnd: 2.40,
};
const POSE_SWAP = 0.34;                       // arm extends into the fist pose mid-takeoff

const SCALE = 0.55, FINAL_Y = 944, BELOW = 2226;

// Root position keyframes: [time, y, easing]. SPEC: dip -> shoot in -> decelerate ->
// overshoot 10-15 px above final -> brief pause -> settle back down. One overshoot only.
const KEYS = [
  [0.00, BELOW, null], [T.empty, BELOW, inOut], [T.antic, BELOW + 30, outQuart],
  [T.takeoff, 1240, outCubic], [T.ascent, 1010, outCubic], [T.decel, 958, outCubic],
  [T.over, FINAL_Y - 14, null], [T.overHold, FINAL_Y - 14, inOut], [T.settled, FINAL_Y, null],
];

function rootY(t) {
  if (t >= T.settled) return FINAL_Y + Math.sin((t - T.settled) * 2.1) * 2.5;   // SPEC: 2-3 px hover
  for (let i = 0; i + 1 < KEYS.length; i++) {
    const [t0, y0] = KEYS[i], [t1, y1, ease] = KEYS[i + 1];
    if (t <= t1) return lerp(y0, y1, (ease || inOut)(inv(t, t0, t1)));
  }
  return FINAL_Y;
}
const vel = t => (rootY(t + 0.008) - rootY(t - 0.008)) / 0.016;    // px/s, negative = rising

// --- drawn assets -----------------------------------------------------------
const CLOUD_BODY = '#DFD0F9', CLOUD_TOP = '#F0E8FD', SPARK = '#FFFFFF', STREAK = '#CFC0F5';

const lobesOf = (r, n, seed) => {
  const span = r * 0.86 * (n - 1);
  return Array.from({ length: n }, (_, i) => {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const rr = r * (0.54 + Math.sin((u + seed * 0.19) * Math.PI) * 0.46);
    return [(u - 0.5) * span, -rr + ((seed * 7 + i * 13) % 5 - 2) * r * 0.02, rr];
  });
};
const disc = (x, y, r) => `M${(x - r).toFixed(1)},${y.toFixed(1)}a${r.toFixed(1)},${r.toFixed(1)} 0 1,0 ${(r * 2).toFixed(1)},0a${r.toFixed(1)},${r.toFixed(1)} 0 1,0 ${(-r * 2).toFixed(1)},0`;

// Each lobe is its own <path>: one path holding all of them has the subpaths wind against
// each other and nonzero fill punches the overlaps out.
const cloud = (x, y, r, n, seed, op) => {
  const lobes = lobesOf(r, n, seed);
  const body = lobes.map(([lx, ly, rr]) => `<path d="${disc(lx, ly, rr)}" fill="${CLOUD_BODY}"/>`).join('');
  const top = lobes.map(([lx, ly, rr]) => `<path d="${disc(lx, ly - rr * 0.16, rr * 0.70)}" fill="${CLOUD_TOP}"/>`).join('');
  return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})" opacity="${op.toFixed(3)}">${body}${top}</g>`;
};

const sparkle = (x, y, r, op) => {
  const a = r * 0.30, b = r * 0.10;
  return `<path d="M0,${-r}C${b},${-a} ${a},${-b} ${r},0C${a},${b} ${b},${a} 0,${r}C${-b},${a} ${-a},${b} ${-r},0C${-a},${-b} ${-b},${-a} 0,${-r}Z" fill="${SPARK}" opacity="${op.toFixed(3)}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"/>`;
};

// Tapered vertical streak, wider at the top, travelling downward.
const streak = (x, y, len, w, op) =>
  `<path d="M${(-w / 2).toFixed(1)},0 L${(w / 2).toFixed(1)},0 L${(w * 0.16).toFixed(1)},${len.toFixed(1)} L${(-w * 0.16).toFixed(1)},${len.toFixed(1)} Z" fill="${STREAK}" opacity="${op.toFixed(3)}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"/>`;

// SPEC: four puffs — two expand left and right, two stay nearer the centre. Gone in ~0.30 s.
const PUFFS = [
  { dx: -232, r: 74, n: 4, seed: 1, vx: -300, lag: 0.00 },
  { dx: 238, r: 72, n: 4, seed: 4, vx: 308, lag: 0.01 },
  { dx: -78, r: 54, n: 3, seed: 2, vx: -96, lag: 0.04 },
  { dx: 86, r: 56, n: 3, seed: 6, vx: 104, lag: 0.05 },
];
const BURST_STREAKS = [{ dx: -62, len: 150 }, { dx: 4, len: 186 }, { dx: 66, len: 158 }];
const BURST_SPARKS = [{ dx: -282, dy: -40, r: 24, lag: 0.10 }, { dx: 286, dy: 20, r: 20, lag: 0.17 }];

// SPEC: during the hover, thin lavender lines run downward OUTSIDE the silhouette.
const FLOW = [{ x: -258, len: 150, w: 7, p: 0.00 }, { x: 266, len: 132, w: 6, p: 0.34 },
{ x: -176, len: 110, w: 5, p: 0.62 }, { x: 194, len: 160, w: 7, p: 0.18 }];

// --- the mascot at time t ---------------------------------------------------
function mascot(t) {
  const y = rootY(t), v = vel(t);
  const flying = t >= POSE_SWAP;
  const pick = id => (!flying && STAND[id] ? vars[STAND[id]] : base[id]);
  const speed = clamp(Math.abs(v) / 3400);

  // SPEC: ~6 % lower and ~2 % wider through the hidden anticipation; ~4 % vertical stretch
  // at peak acceleration, back to normal immediately after.
  const anticip = inv(t, T.empty, T.antic) * (1 - inv(t, T.antic, T.antic + 0.06));
  const sy = 1 - 0.06 * anticip + 0.04 * speed;
  const sx = 1 + 0.02 * anticip - 0.02 * speed;

  // Cape: pinned at the collar, widens with airflow, never rises above the shoulders.
  const flare = flying ? lerp(1.10, 1.74, speed) + (t > T.settled ? Math.sin((t - T.settled) * 2.4) * 0.045 : 0) : 0.74;
  const capeT = `translate(${CAPE_PIVOT[0]},${CAPE_PIVOT[1]}) scale(${flare.toFixed(4)},${(1 + 0.10 * speed).toFixed(3)}) translate(${-CAPE_PIVOT[0]},${-CAPE_PIVOT[1]})`;

  let g = '';
  for (const id of ORDER) {
    const art = pick(id);
    if (!art) continue;
    const lag = (LAG[id] || 0) * -v;                    // rising (v<0) pushes parts down
    const inner = id.startsWith('cape') ? `<g transform="${capeT}">${art}</g>` : art;
    g += lag ? `<g transform="translate(0,${(lag / SCALE).toFixed(2)})">${inner}</g>` : inner;
  }

  const tf = `translate(${(W / 2).toFixed(1)},${y.toFixed(1)}) scale(${(SCALE * sx).toFixed(5)},${(SCALE * sy).toFixed(5)}) translate(${-CX},${-CX})`;
  return { svg: `<g transform="${tf}">${g}</g>`, y, v, speed };
}

// --- the whole frame --------------------------------------------------------
export function frame(t) {
  const m = mascot(t);
  const feet = m.y + 250;

  // SPEC: burst at ~0.30 s, gone within ~0.30 s.
  let fx = '';
  const k = t - 0.30;
  if (k >= 0 && k < 0.62) {
    for (const p of PUFFS) {
      const a = k - p.lag;
      if (a < 0) continue;
      const grow = outCubic(clamp(a / 0.16));
      const fade = 1 - clamp((a - 0.12) / 0.30) ** 2;
      if (fade <= 0.01) continue;
      fx += cloud(W / 2 + p.dx + p.vx * a, 1792 + 150 * a * a, p.r * lerp(0.4, 1, grow), p.n, p.seed, fade * 0.95);
    }
    for (const [i, s] of BURST_STREAKS.entries()) {
      const a = k - i * 0.02;
      if (a < 0) continue;
      const fade = 1 - clamp(a / 0.34) ** 2;
      if (fade <= 0.01) continue;
      fx += streak(W / 2 + s.dx, 1700 + 620 * a, s.len, 15, fade * 0.8);
    }
    for (const s of BURST_SPARKS) {
      const a = k - s.lag;
      if (a < 0 || a > 0.5) continue;
      fx += sparkle(W / 2 + s.dx, 1690 + s.dy + 300 * a, s.r * (0.5 + 0.6 * Math.sin(clamp(a / 0.5) * Math.PI)), Math.sin(clamp(a / 0.5) * Math.PI) * 0.9);
    }
  }

  // SPEC: during the ascent and the hover, lavender lines run downward outside the silhouette.
  let flow = '';
  if (t > T.antic) {
    const vis = clamp(inv(t, T.antic, T.takeoff) - inv(t, 3.5, 4.0));
    for (const f of FLOW) {
      const ph = ((t - T.antic) * 0.85 + f.p) % 1;
      const op = Math.sin(ph * Math.PI) * 0.5 * vis * (0.45 + 0.55 * m.speed);
      if (op <= 0.01) continue;
      flow += streak(W / 2 + f.x, lerp(m.y - 240, m.y + 420, ph), f.len, f.w, op);
    }
  }

  // SPEC: 2-3 tiny sparkles, scale 0 -> 110 % -> 0, quick.
  let accent = '';
  if (t >= T.accent && t <= T.accentEnd + 1.2) {
    for (const [i, d] of [[-300, -140], [312, 40], [-268, 190]].entries()) {
      const ph = ((t - T.accent) * 0.8 + i * 0.33) % 1;
      const s = Math.sin(ph * Math.PI);
      accent += sparkle(W / 2 + d[0], FINAL_Y + d[1], 24 * s * 1.1, s * 0.9);
    }
  }

  // SPEC: Twist 90 % -> 104 % -> 100 %, rising 8 px, no rotation. POWERED BY IST 0.12 s later.
  let word = '';
  const wu = inv(t, T.word, T.wordEnd);
  if (wu > 0) {
    const s = wu < 0.62 ? lerp(0.90, 1.04, outCubic(wu / 0.62)) : lerp(1.04, 1.00, inOut((wu - 0.62) / 0.38));
    const pu = inv(t, T.powered, T.poweredEnd);
    word = `<g transform="translate(${W / 2},${(1758 + 8 * (1 - outCubic(wu))).toFixed(1)})">` +
      `<g opacity="${outCubic(wu).toFixed(3)}" transform="scale(${s.toFixed(4)})">` +
      `<text text-anchor="middle" font-family="SF Pro Rounded, SF Pro Display, Avenir Next, sans-serif" ` +
      `font-size="124" font-weight="700" fill="#FFFFFF" letter-spacing="-2">Twist</text></g>` +
      (pu > 0 ? `<text text-anchor="middle" y="${(66 + 5 * (1 - pu)).toFixed(1)}" opacity="${(pu * 0.62).toFixed(3)}" ` +
        `font-family="SF Pro Text, Avenir Next, sans-serif" font-size="30" font-weight="600" fill="#FFFFFF" letter-spacing="7.5">POWERED BY IST</text>` : '') +
      `</g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0.12" y2="1">
<stop offset="0" stop-color="#9B4DEE"/><stop offset="0.55" stop-color="#8F46EC"/><stop offset="1" stop-color="#7F40EB"/>
</linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${flow}${fx}${m.svg}${accent}${word}</svg>`;
}

export const NFRAMES = Math.round(DUR * FPS);
