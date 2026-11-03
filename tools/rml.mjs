// out/mascot_parts.svg -> a Rive .rml scene, with the SPEC.md launch as a LinearAnimation.
// Rive has no SVG import, so the cubics are converted to CubicDetachedVertex polar handles:
// a handle sits at anchor + (cos(rot), sin(rot)) * dist, so it follows an anchor that moves.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = process.env.RML_OUT || path.join(process.env.HOME, 'Documents/twist-splash/scene.rml');

const AW = 540, AH = 960;              // artboard, exactly half of 1080x1920
const K = 0.5;                         // scene.mjs works in 1080x1920; halve into the artboard
const ART = 1254, CX = 627;            // the mascot art's own box
const SCALE = 0.55 * K;                // mascot scale inside the artboard
const FPS = 60, DUR_S = 4.0;

// --- skeleton ---------------------------------------------------------------
// Local space = art coords minus (CX, CX). The collar sits at art (627,596) -> (0,-31).
// Cape chain: pinned at the collar, one bone down the upper cape, one for the hem.
const COLLAR = [0, -31];
const BONES = {
  cape_spine: { id: '0:800', root: true, x: COLLAR[0], y: COLLAR[1], length: 150, rotation: Math.PI / 2 },
  cape_hem: { id: '0:801', parent: 'cape_spine', length: 150, rotation: 0 },
  cape_wingL: { id: '0:802', root: true, x: -64, y: -18, length: 360, rotation: 2.57 },
  cape_wingR: { id: '0:803', root: true, x: 64, y: -18, length: 360, rotation: 0.576 },
  // one bone per limb, pivoting on the joint lines in parts/spec.mjs
  arm_L_b: { id: '0:810', root: true, x: -132, y: -37, length: 120, rotation: -1.9 },
  arm_R_b: { id: '0:811', root: true, x: 129, y: -21, length: 120, rotation: 1.0 },
  leg_L_b: { id: '0:812', root: true, x: -77, y: 173, length: 150, rotation: Math.PI / 2 },
  leg_R_b: { id: '0:813', root: true, x: 88, y: 188, length: 150, rotation: Math.PI / 2 },
};
// Which parts get skinned, and how a vertex's weight is split down the chain.
// SPEC: the cape's top edge is pinned to the shoulders; only the lower half may deform.
const SKINNED = {
  cape_L: ['cape_spine', 'cape_hem', 'cape_wingL', 'cape_wingR'], cape_R: ['cape_spine', 'cape_hem', 'cape_wingL', 'cape_wingR'], cape_mid: ['cape_spine', 'cape_hem', 'cape_wingL', 'cape_wingR'],
  arm_L: ['arm_L_b'], hand_L: ['arm_L_b'],
  arm_R_upper: ['arm_R_b'], hand_R: ['arm_R_b'],
  leg_L: ['leg_L_b'], leg_R: ['leg_R_b'],
};
const HEM_START = 55, HEM_FULL = 340;  // local y over which influence hands off to the hem bone
const SIDE_START = 60, SIDE_FULL = 390, DOWN_START = -40, DOWN_FULL = 250;
const smooth = u => u * u * (3 - 2 * u);
// Four tendons is Rive's per-vertex limit. The collar end stays on the spine, so the cape
// can never lift over the head; the wings only take over lower down and further out.
function capeWeights(x, y) {
  const side = smooth(clamp((Math.abs(x) - SIDE_START) / (SIDE_FULL - SIDE_START)));
  const down = smooth(clamp((y - DOWN_START) / (DOWN_FULL - DOWN_START)));
  const wing = side * (0.55 + 0.45 * down);
  const hem = (1 - side) * down;
  const w = [Math.max(0, 1 - wing - hem), hem, x < 0 ? wing : 0, x < 0 ? 0 : wing];
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const b = w.map(v => Math.round(255 * v / sum));
  b[0] += 255 - b.reduce((a, c) => a + c, 0);
  return {
    values: (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0,
    indices: (1 | (2 << 8) | (3 << 16) | (4 << 24)) >>> 0,
  };
}

// 2x3 affine, applied as  x' = xx*x + yx*y + tx ,  y' = xy*x + yy*y + ty
const trs = (x, y, r) => ({ xx: Math.cos(r), xy: Math.sin(r), yx: -Math.sin(r), yy: Math.cos(r), tx: x, ty: y });
const mul = (a, b) => ({
  xx: a.xx * b.xx + a.yx * b.xy, xy: a.xy * b.xx + a.yy * b.xy,
  yx: a.xx * b.yx + a.yx * b.yy, yy: a.xy * b.yx + a.yy * b.yy,
  tx: a.xx * b.tx + a.yx * b.ty + a.tx, ty: a.xy * b.tx + a.yy * b.ty + a.ty,
});
function invert2x3(m) {
  const d = m.xx * m.yy - m.yx * m.xy;
  const xx = m.yy / d, yx = -m.yx / d, xy = -m.xy / d, yy = m.xx / d;
  return { xx, yx, xy, yy, tx: -(xx * m.tx + yx * m.ty), ty: -(xy * m.tx + yy * m.ty) };
}
// A bone sits at its PARENT's tip, so a child's translation is the parent's length.
function boneWorld(name) {
  const b = BONES[name];
  const local = trs(b.root ? b.x : BONES[b.parent].length, b.root ? b.y : 0, b.rotation || 0);
  return b.root ? local : mul(boneWorld(b.parent), local);
}
function boneXml(name, indent) {
  const b = BONES[name];
  const kids = Object.keys(BONES).filter(k => BONES[k].parent === name);
  const tag = b.root ? `<RootBone x="${b.x}" y="${b.y}"` : `<Bone`;
  const attrs = ` rotation="${(b.rotation || 0).toFixed(5)}" length="${b.length}" name="${name}" id="${b.id}"`;
  if (!kids.length) return `${indent}${tag}${attrs}/>\n`;
  return `${indent}${tag}${attrs}>\n` + kids.map(k => boneXml(k, indent + '  ')).join('') +
    `${indent}</${b.root ? 'RootBone' : 'Bone'}>\n`;
}

// ---------- SVG path parsing ------------------------------------------------
const NUM = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

function parsePath(d) {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  const subs = [];
  let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = '', i = 0;
  const num = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    const t = toks[i];
    if (/^[A-Za-z]$/.test(t)) { cmd = t; i++; }
    switch (cmd) {
      case 'M': case 'm': {
        const nx = cmd === 'M' ? num() : x + num(), ny = cmd === 'M' ? num() : y + num();
        x = nx; y = ny; sx = x; sy = y;
        cur = { start: [x, y], segs: [], closed: false };
        subs.push(cur);
        cmd = cmd === 'M' ? 'L' : 'l';                 // subsequent pairs are implicit linetos
        break;
      }
      case 'L': case 'l': {
        const nx = cmd === 'L' ? num() : x + num(), ny = cmd === 'L' ? num() : y + num();
        cur.segs.push({ t: 'L', to: [nx, ny] }); x = nx; y = ny; break;
      }
      case 'H': case 'h': { const nx = cmd === 'H' ? num() : x + num(); cur.segs.push({ t: 'L', to: [nx, y] }); x = nx; break; }
      case 'V': case 'v': { const ny = cmd === 'V' ? num() : y + num(); cur.segs.push({ t: 'L', to: [x, ny] }); y = ny; break; }
      case 'C': case 'c': {
        const r = cmd === 'c';
        const c1 = [r ? x + num() : num(), r ? y + num() : num()];
        const c2 = [r ? x + num() : num(), r ? y + num() : num()];
        const to = [r ? x + num() : num(), r ? y + num() : num()];
        cur.segs.push({ t: 'C', c1, c2, to }); x = to[0]; y = to[1]; break;
      }
      // the command token was already consumed above; incrementing again here would swallow the next M
      case 'Z': case 'z': { if (cur) cur.closed = true; x = sx; y = sy; cmd = ''; break; }
      default: i++;                                     // anything unexpected: skip the token
    }
  }
  return subs.filter(s => s.segs.length);
}

// A subpath -> vertices carrying the in/out handles of the segments either side.
function vertices(sub) {
  const pts = [sub.start, ...sub.segs.map(s => s.to)];
  const n = sub.segs.length;
  // a closed path whose last point lands on the first shares one vertex
  const wraps = sub.closed && Math.hypot(pts[n][0] - pts[0][0], pts[n][1] - pts[0][1]) < 0.01;
  const count = wraps ? n : n + 1;
  const out = [];
  for (let k = 0; k < count; k++) {
    const p = pts[k];
    const outSeg = sub.segs[k] || (sub.closed ? sub.segs[0] : null);
    const inSeg = sub.segs[k - 1] || (k === 0 && wraps ? sub.segs[n - 1] : null);
    const h = (ctrl) => {
      if (!ctrl) return [0, 0];
      const dx = ctrl[0] - p[0], dy = ctrl[1] - p[1];
      return [Math.atan2(dy, dx), Math.hypot(dx, dy)];
    };
    const [oR, oD] = h(outSeg && outSeg.t === 'C' ? outSeg.c1 : null);
    const [iR, iD] = h(inSeg && inSeg.t === 'C' ? inSeg.c2 : null);
    out.push({ x: p[0], y: p[1], iR, iD, oR, oD });
  }
  return { verts: out, closed: sub.closed };
}

// ---------- read the parts --------------------------------------------------
const svg = fs.readFileSync(path.join(ROOT, 'out/mascot_parts.svg'), 'utf8');

function readGroups(s) {
  const groups = [];
  const open = /<g id="([^"]+)"[^>]*>/g;
  let m;
  while ((m = open.exec(s))) {
    let depth = 1;
    const tag = /<g\b[^>]*>|<\/g>/g;
    tag.lastIndex = open.lastIndex;
    let t;
    while (depth && (t = tag.exec(s))) depth += t[0] === '</g>' ? -1 : 1;
    groups.push([m[1], s.slice(open.lastIndex, t.index)]);
    open.lastIndex = tag.lastIndex;
  }
  return groups;
}

const ORDER = ['cape_L', 'cape_R', 'cape_mid', 'leg_L', 'leg_R', 'torso', 'arm_R_upper', 'hand_R',
  'collar', 'arm_L', 'hand_L', 'ear_L', 'ear_R', 'head', 'eye_L', 'eye_R',
  'blush_L', 'blush_R', 'nose', 'mouth', 'medal'];

const groups = Object.fromEntries(readGroups(svg));
const esc = s => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const f = v => (Math.round(v * 1000) / 1000);
const argb = hex => 'FF' + hex.replace('#', '').toUpperCase();

let idN = 100;
const nid = () => `0:${idN++}`;

let shapeCount = 0, vertCount = 0, skipped = [];
const skinned = new Set();

// Rive's draw order is the REVERSE of SVG's: the first drawable declared paints last, on top.
// So parts and the paths inside them are both emitted back-to-front reversed.
function partXml(name, body, indent) {
  const paths = [...body.matchAll(/<path([^>]*?)\/>/g)].reverse();
  let out = '';
  for (const [, attrs] of paths) {
    const d = (attrs.match(/\sd="([^"]*)"/) || [])[1];
    const fill = (attrs.match(/fill="(#[0-9A-Fa-f]{6})"/) || [])[1];
    if (!d || !fill) { if (d) skipped.push(name); continue; }
    const subs = parsePath(d);
    if (!subs.length) continue;
    const chain = SKINNED[name];
    let inner = '';
    for (const sub of subs) {
      const { verts, closed } = vertices(sub);
      if (verts.length < 2) continue;
      vertCount += verts.length;
      inner += `${indent}  <PointsPath${closed ? ' isClosed="true"' : ''} name="P">\n`;
      for (const v of verts) {
        const lx = v.x - CX, ly = v.y - CX;
        const open = `${indent}    <CubicDetachedVertex x="${f(lx)}" y="${f(ly)}"` +
          (v.iD ? ` inRotation="${f(v.iR)}" inDistance="${f(v.iD)}"` : '') +
          (v.oD ? ` outRotation="${f(v.oR)}" outDistance="${f(v.oD)}"` : '');
        if (!chain) { inner += open + '/>\n'; continue; }
        // hand influence from the upper bone to the hem bone as the vertex gets further down
        let values = 255, indices = 1;                       // single bone: all weight on tendon 0
        if (chain.length === 4) ({ values, indices } = capeWeights(lx, ly));
        inner += open + `>\n${indent}      <CubicWeight inValues="${values}" inIndices="${indices}"` +
          ` outValues="${values}" outIndices="${indices}" name="W"/>\n${indent}    </CubicDetachedVertex>\n`;
      }
      if (chain) {
        // Skin bind is identity: the path's local space already IS the mascot's.
        // Each tendon carries the INVERSE of its bone's bind transform, so the rest pose is a no-op.
        inner += `${indent}    <Skin xx="1" yx="0" xy="0" yy="1" tx="0" ty="0" name="Skin">\n`;
        for (const bn of chain) {
          const b = BONES[bn];
          const inv = boneWorld(bn);   // forward bind, not inverted
          inner += `${indent}      <Tendon boneId="${b.id}" xx="${f(inv.xx)}" yx="${f(inv.yx)}"` +
            ` xy="${f(inv.xy)}" yy="${f(inv.yy)}" tx="${f(inv.tx)}" ty="${f(inv.ty)}" name="${bn}"/>\n`;
        }
        inner += `${indent}    </Skin>\n`;
        skinned.add(name);
      }
      inner += `${indent}  </PointsPath>\n`;
    }
    if (!inner) continue;
    shapeCount++;
    out += `${indent}<Shape name="${esc(name)}" id="${nid()}">\n${inner}` +
      `${indent}  <Fill name="F"><SolidColor colorValue="${argb(fill)}" name="C"/></Fill>\n${indent}</Shape>\n`;
  }
  return out;
}

// ---------- the launch curve, straight from SPEC.md -------------------------
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const inv = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const outCubic = u => 1 - (1 - u) ** 3;
const outQuart = u => 1 - (1 - u) ** 4;
const inOut = u => u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;

const FINAL_Y = 944 * K, BELOW = 2226 * K;
const KEYS = [
  [0.00, BELOW, null], [0.10, BELOW, inOut], [0.25, BELOW + 30 * K, outQuart],
  [0.55, 1240 * K, outCubic], [0.95, 1010 * K, outCubic], [1.15, 958 * K, outCubic],
  [1.25, FINAL_Y - 14 * K, null], [1.35, FINAL_Y - 14 * K, inOut], [1.60, FINAL_Y, null],
];
function rootY(t) {
  if (t >= 1.60) return FINAL_Y + Math.sin((t - 1.60) * 2.1) * 2.5 * K;
  for (let i = 0; i + 1 < KEYS.length; i++) {
    const [t0, y0] = KEYS[i], [t1, y1, ease] = KEYS[i + 1];
    if (t <= t1) return lerp(y0, y1, (ease || inOut)(inv(t, t0, t1)));
  }
  return FINAL_Y;
}

// Bake one key per frame: the eased segments are not cubic-bezier-expressible, and at 60 fps
// a baked curve is exact rather than approximated.
function bakedKeys(fn, dp = 2) {
  const n = Math.round(DUR_S * FPS);
  const rows = [];
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const v = +fn(i / FPS).toFixed(dp);
    if (v !== prev) { rows.push([i, v]); prev = v; }
  }
  return rows;
}

const keyed = (objectId, key, rows, interp = 'linear') =>
  `      <KeyedObject objectId="${objectId}">\n        <KeyedProperty propertyKey="${key}">\n` +
  rows.map(([fr, v]) => `          <KeyFrameDouble frame="${fr}" value="${v}" interpolationType="${interp}"/>`).join('\n') +
  `\n        </KeyedProperty>\n      </KeyedObject>\n`;

// ---------- assemble --------------------------------------------------------
const ROOT_ID = '0:10';
// The three SVG cape groups become ONE <Node name="Cape">, declared last so it paints behind
// the body. Rive's draw order is the reverse of the declaration order.
let parts = '', capeInner = '';
for (const name of [...ORDER].reverse()) {
  if (!groups[name]) { skipped.push(name + ' (missing)'); continue; }
  const isCape = name.startsWith('cape');
  const xml = partXml(name, groups[name], isCape ? '          ' : '        ');
  if (isCape) capeInner += xml; else parts += xml;
}
const capeNode = capeInner ? `        <Node name="Cape" id="0:20">\n${capeInner}        </Node>\n` : '';

const velR = t => (rootY(t + 0.008) - rootY(t - 0.008)) / 0.016;      // artboard px/s, negative = rising
const speed = t => clamp(Math.abs(velR(t)) / (3400 * K));

// SPEC: cape corners trail BELOW the shoulders, widen under airflow, one soft wave on the hover.
// Both bones stay below the collar, so the cape can never pass over the head.
const wave = t => t > 1.60 ? Math.sin((t - 1.60) * 2.4) : 0;
// SPEC: airflow widens the cape into a broad shallow V behind the body and drags the hem down;
// one soft wave travels through it on the hover. The spine stays near vertical throughout.
const capeSpine = t => Math.PI / 2 + 0.10 * speed(t) + 0.03 * wave(t);
const capeHem = t => 0.16 * speed(t) + 0.08 * wave(t);
const capeWingL = t => 2.57 + 0.16 * speed(t) + 0.06 * wave(t);
const capeWingR = t => 0.576 - 0.16 * speed(t) - 0.06 * wave(t);

const yRows = bakedKeys(rootY);
const upRows = bakedKeys(capeSpine, 4);
const hemRows = bakedKeys(capeHem, 4);
const wLRows = bakedKeys(capeWingL, 4);
const wRRows = bakedKeys(capeWingR, 4);
const limb = (base, k, wk) => t => base + k * speed(t) + wk * wave(t);
const limbRows = {
  arm_L_b: bakedKeys(limb(-1.9, 0.10, 0.02), 4),
  arm_R_b: bakedKeys(limb(1.0, -0.12, 0.025), 4),
  leg_L_b: bakedKeys(limb(Math.PI / 2, 0.16, 0.03), 4),
  leg_R_b: bakedKeys(limb(Math.PI / 2, 0.20, 0.035), 4),
};
const anim =
  `    <LinearAnimation name="Launch" fps="${FPS}" duration="${Math.round(DUR_S * FPS)}" loopValue="0" id="0:900">\n` +
  keyed(ROOT_ID, 14, yRows) +
  keyed(BONES.cape_spine.id, 15, upRows) +
  keyed(BONES.cape_hem.id, 15, hemRows) +
  keyed(BONES.cape_wingL.id, 15, wLRows) +
  keyed(BONES.cape_wingR.id, 15, wRRows) +
  Object.entries(limbRows).map(([b, rows]) => keyed(BONES[b].id, 15, rows)).join('') +
  `    </LinearAnimation>\n`;

// Backdrop is declared LAST so it paints FIRST, behind the mascot.
const rml = `<Rive version="1" kind="fragment">
  <Artboard styleId="0:5" width="${AW}" height="${AH}" name="Splash" id="0:2">
    <LayoutComponentStyle name="Artboard Style" id="0:5"/>

    <Node x="${AW / 2}" y="${f(rootY(0))}" scaleX="${f(SCALE)}" scaleY="${f(SCALE)}" name="Mascot" id="${ROOT_ID}">
${Object.keys(BONES).filter(k => BONES[k].root).map(k => boneXml(k, '      ')).join('')}
${parts}${capeNode}    </Node>

    <Shape name="Backdrop" id="0:3">
      <Rectangle width="${AW}" height="${AH}" x="${AW / 2}" y="${AH / 2}" name="P"/>
      <Fill name="F">
        <LinearGradient startX="0" startY="0" endX="0" endY="${AH}" name="G">
          <GradientStop colorValue="FF9B4DEE" position="0"/>
          <GradientStop colorValue="FF7F40EB" position="1"/>
        </LinearGradient>
      </Fill>
    </Shape>

${anim}  </Artboard>
</Rive>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, rml);
console.log(`wrote ${OUT}`);
console.log(`  shapes ${shapeCount}, vertices ${vertCount}, keys: y ${yRows.length}, capeUp ${upRows.length}, capeHem ${hemRows.length}`);
console.log(`  skinned: ${[...skinned].join(', ') || 'none'}`);
if (skipped.length) console.log(`  skipped: ${[...new Set(skipped)].join(', ')}`);
