// Cape only: all three SVG groups merged into one <Node name="Cape">, on a 4-bone rig.
// Iterate here with the CLI, then fold the result back into tools/rml.mjs.
//   node tools/cape.mjs && rive ~/Documents/cape-rig --once
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = process.env.CAPE_OUT || path.join(process.env.HOME, 'Documents/cape-rig/scene.rml');

const AW = 560, AH = 560, CX = 627;
const SCALE = 0.56;                     // cape is 822 wide locally -> ~460 in the artboard
const FPS = 60, DUR_S = 3.0;

// --- the rig ----------------------------------------------------------------
// Cape local bbox: x -409..413, y -72..273. Collar at (0,-31).
// Spine down the middle, one bone per wing. Four tendons, which is Rive's per-vertex limit.
const BONES = {
  spine: { id: '0:800', root: true, x: 0, y: -31, length: 150, rotation: Math.PI / 2 },
  hem: { id: '0:801', parent: 'spine', length: 150, rotation: 0 },
  wingL: { id: '0:802', root: true, x: -64, y: -18, length: 360, rotation: 2.57 },
  wingR: { id: '0:803', root: true, x: 64, y: -18, length: 360, rotation: 0.576 },
};
const TENDONS = ['spine', 'hem', 'wingL', 'wingR'];   // tendon index = position in this list

const SIDE_START = 60, SIDE_FULL = 330;    // |x| over which a wing takes over from the spine
const DOWN_START = -40, DOWN_FULL = 250;   // y over which the hem takes over

const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const smooth = u => u * u * (3 - 2 * u);

// Weight one vertex across the four tendons. The collar end stays pinned to the spine,
// so the cape can never lift over the head.
function weights(x, y) {
  const side = smooth(clamp((Math.abs(x) - SIDE_START) / (SIDE_FULL - SIDE_START)));
  const down = smooth(clamp((y - DOWN_START) / (DOWN_FULL - DOWN_START)));
  const wing = side * (0.35 + 0.65 * down);
  const hem = (1 - side) * down;
  const spine = Math.max(0, 1 - wing - hem);
  const w = [spine, hem, x < 0 ? wing : 0, x < 0 ? 0 : wing];
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  let b = w.map(v => Math.round(255 * v / sum));
  b[0] += 255 - b.reduce((a, c) => a + c, 0);          // make the bytes total exactly 255
  const values = (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
  const indices = (1 | (2 << 8) | (3 << 16) | (4 << 24)) >>> 0;
  return { values, indices };
}

// --- 2x3 affine, x' = xx*x + yx*y + tx ,  y' = xy*x + yy*y + ty ---------------
const trs = (x, y, r) => ({ xx: Math.cos(r), xy: Math.sin(r), yx: -Math.sin(r), yy: Math.cos(r), tx: x, ty: y });
const mul = (a, b) => ({
  xx: a.xx * b.xx + a.yx * b.xy, xy: a.xy * b.xx + a.yy * b.xy,
  yx: a.xx * b.yx + a.yx * b.yy, yy: a.xy * b.yx + a.yy * b.yy,
  tx: a.xx * b.tx + a.yx * b.ty + a.tx, ty: a.xy * b.tx + a.yy * b.ty + a.ty,
});
// A bone sits at its PARENT's tip, so a child's translation is the parent's length.
function boneWorld(n) {
  const b = BONES[n];
  const local = trs(b.root ? b.x : BONES[b.parent].length, b.root ? b.y : 0, b.rotation || 0);
  return b.root ? local : mul(boneWorld(b.parent), local);
}
function boneXml(n, indent) {
  const b = BONES[n];
  const kids = Object.keys(BONES).filter(k => BONES[k].parent === n);
  const tag = b.root ? `<RootBone x="${b.x}" y="${b.y}"` : `<Bone`;
  const a = ` rotation="${(b.rotation || 0).toFixed(5)}" length="${b.length}" name="${n}" id="${b.id}"`;
  return kids.length
    ? `${indent}${tag}${a}>\n` + kids.map(k => boneXml(k, indent + '  ')).join('') + `${indent}</${b.root ? 'RootBone' : 'Bone'}>\n`
    : `${indent}${tag}${a}/>\n`;
}

// --- SVG path -> vertices ----------------------------------------------------
function parsePath(d) {
  const toks = d.match(/[MmLlHhVvCcZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  const subs = []; let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = '', i = 0;
  const num = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    const t = toks[i];
    if (/^[A-Za-z]$/.test(t)) { cmd = t; i++; }
    switch (cmd) {
      case 'M': case 'm': {
        const nx = cmd === 'M' ? num() : x + num(), ny = cmd === 'M' ? num() : y + num();
        x = nx; y = ny; sx = x; sy = y; cur = { start: [x, y], segs: [], closed: false }; subs.push(cur);
        cmd = cmd === 'M' ? 'L' : 'l'; break;
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
      case 'Z': case 'z': { if (cur) cur.closed = true; x = sx; y = sy; cmd = ''; break; }
      default: i++;
    }
  }
  return subs.filter(s => s.segs.length);
}
function vertices(sub) {
  const pts = [sub.start, ...sub.segs.map(s => s.to)];
  const n = sub.segs.length;
  const wraps = sub.closed && Math.hypot(pts[n][0] - pts[0][0], pts[n][1] - pts[0][1]) < 0.01;
  const out = [];
  for (let k = 0; k < (wraps ? n : n + 1); k++) {
    const p = pts[k];
    const outSeg = sub.segs[k] || (sub.closed ? sub.segs[0] : null);
    const inSeg = sub.segs[k - 1] || (k === 0 && wraps ? sub.segs[n - 1] : null);
    const h = c => c ? [Math.atan2(c[1] - p[1], c[0] - p[0]), Math.hypot(c[0] - p[0], c[1] - p[1])] : [0, 0];
    const [oR, oD] = h(outSeg && outSeg.t === 'C' ? outSeg.c1 : null);
    const [iR, iD] = h(inSeg && inSeg.t === 'C' ? inSeg.c2 : null);
    out.push({ x: p[0], y: p[1], iR, iD, oR, oD });
  }
  return { verts: out, closed: sub.closed };
}

// --- build -------------------------------------------------------------------
const svg = fs.readFileSync(path.join(ROOT, 'out/mascot_parts.svg'), 'utf8');
const grp = n => (svg.match(new RegExp(`<g id="${n}">([\\s\\S]*?)</g>\\n`)) || ['', ''])[1];

const f = v => Math.round(v * 1000) / 1000;
const argb = h => 'FF' + h.replace('#', '').toUpperCase();
let idN = 1000; const nid = () => `0:${idN++}`;

const skinXml = indent => {
  let s = `${indent}<Skin xx="1" yx="0" xy="0" yy="1" tx="0" ty="0" name="Skin">\n`;
  for (const t of TENDONS) {
    const w = boneWorld(t);                            // FORWARD bind, not the inverse
    s += `${indent}  <Tendon boneId="${BONES[t].id}" xx="${f(w.xx)}" yx="${f(w.yx)}" xy="${f(w.xy)}" yy="${f(w.yy)}" tx="${f(w.tx)}" ty="${f(w.ty)}" name="${t}"/>\n`;
  }
  return s + `${indent}</Skin>\n`;
};

let shapes = '', nShapes = 0, nVerts = 0;
// Rive paints the FIRST drawable last, so the whole SVG order reverses: groups back to front,
// and the paths inside each group too. Reversing only one of the two cancels out.
const paths = [];
for (const g of ['cape_mid', 'cape_R', 'cape_L']) {
  for (const m of [...grp(g).matchAll(/<path([^>]*?)\/>/g)].reverse()) paths.push([g, m[1]]);
}
for (const [g, attrs] of paths) {
  const d = (attrs.match(/\sd="([^"]*)"/) || [])[1];
  const fill = (attrs.match(/fill="(#[0-9A-Fa-f]{6})"/) || [])[1];
  if (!d || !fill) continue;
  let inner = '';
  for (const sub of parsePath(d)) {
    const { verts, closed } = vertices(sub);
    if (verts.length < 2) continue;
    nVerts += verts.length;
    inner += `      <PointsPath${closed ? ' isClosed="true"' : ''} name="P">\n`;
    for (const v of verts) {
      const lx = v.x - CX, ly = v.y - CX;
      const { values, indices } = weights(lx, ly);
      inner += `        <CubicDetachedVertex x="${f(lx)}" y="${f(ly)}"` +
        (v.iD ? ` inRotation="${f(v.iR)}" inDistance="${f(v.iD)}"` : '') +
        (v.oD ? ` outRotation="${f(v.oR)}" outDistance="${f(v.oD)}"` : '') + `>\n` +
        `          <CubicWeight inValues="${values}" inIndices="${indices}" outValues="${values}" outIndices="${indices}" name="W"/>\n` +
        `        </CubicDetachedVertex>\n`;
    }
    inner += skinXml('        ');
    inner += `      </PointsPath>\n`;
  }
  if (!inner) continue;
  nShapes++;
  shapes += `      <Shape name="${g}" id="${nid()}">\n${inner}` +
    `        <Fill name="F"><SolidColor colorValue="${argb(fill)}" name="C"/></Fill>\n      </Shape>\n`;
}

// --- test animation: sweep the bones so the deformation is visible ------------
const keyed = (id, key, rows) =>
  `      <KeyedObject objectId="${id}">\n        <KeyedProperty propertyKey="${key}">\n` +
  rows.map(([fr, v]) => `          <KeyFrameDouble frame="${fr}" value="${v}" interpolationType="linear"/>`).join('\n') +
  `\n        </KeyedProperty>\n      </KeyedObject>\n`;
const bake = fn => {
  const n = Math.round(DUR_S * FPS), rows = []; let prev = null;
  for (let i = 0; i <= n; i++) { const v = +fn(i / FPS).toFixed(4); if (v !== prev) { rows.push([i, v]); prev = v; } }
  return rows;
};
const osc = (base, amp, hz, ph = 0) => t => base + amp * Math.sin((t * hz + ph) * Math.PI * 2);
const anim =
  `    <LinearAnimation name="CapeTest" fps="${FPS}" duration="${Math.round(DUR_S * FPS)}" loopValue="1" id="0:900">\n` +
  keyed(BONES.spine.id, 15, bake(osc(Math.PI / 2, 0.16, 0.5))) +
  keyed(BONES.hem.id, 15, bake(osc(0, 0.34, 0.5, 0.18))) +
  keyed(BONES.wingL.id, 15, bake(osc(2.57, 0.26, 0.5, 0.3))) +
  keyed(BONES.wingR.id, 15, bake(osc(0.576, -0.26, 0.5, 0.3))) +
  `    </LinearAnimation>\n`;

const rml = `<Rive version="1" kind="fragment">
  <Artboard styleId="0:5" width="${AW}" height="${AH}" name="Cape" id="0:2">
    <LayoutComponentStyle name="Artboard Style" id="0:5"/>

    <Node x="${AW / 2}" y="${AH / 2 - 20}" scaleX="${SCALE}" scaleY="${SCALE}" name="Cape" id="0:10">
${Object.keys(BONES).filter(k => BONES[k].root).map(k => boneXml(k, '      ')).join('')}
${shapes}    </Node>

    <Shape name="Backdrop" id="0:3">
      <Rectangle width="${AW}" height="${AH}" x="${AW / 2}" y="${AH / 2}" name="P"/>
      <Fill name="F"><SolidColor colorValue="FF8F46EC" name="C"/></Fill>
    </Shape>

${anim}  </Artboard>
</Rive>
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, rml);
console.log(`wrote ${OUT}`);
console.log(`  one Cape node: ${nShapes} shapes, ${nVerts} weighted vertices, ${TENDONS.length} tendons each`);
