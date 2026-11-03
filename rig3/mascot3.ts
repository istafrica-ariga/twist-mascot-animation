// The Twist mascot as an animated rig — built ONLY from the user's own art.
//   • fly drawing  = the user's original parts, untouched (out/mascot_parts.svg, split from their Figma SVG)
//   • stand drawing = generated stand body (traced into their palette, rig3/stand_body.json) + their exact head, ears,
//                     face, collar and medal; closed mouth from out/mascot_variants.svg
// The two drawings live under a Solo (Rive's pose-swap) and switch on the squash/stretch frames of launch and land.
// Coordinates: the reference's 1254 × 1254 space. Built at author time in node → rig3/mascot3.rig.json.
import fs from 'node:fs';
import path from 'node:path';
import { RigBuilder, type V } from '../twist-rig/src/builder';
import type { RigModel } from '../twist-rig/src/types';
import type { StateMachine } from '../twist-rig/src/state-machine';

type Props = Record<string, number | string | boolean>;
type F = [number, number, (number | 'linear' | 'hold')?];
type PathEl = { d: string; fill: number | null; stroke?: { color: number; width: number } };
const ROOT = path.resolve(path.dirname(process.argv[1]), '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const argb = (hex: string) => (0xff000000 | parseInt(hex.slice(1), 16)) >>> 0;

// ── SVG → builder contours ──
/** Path data (M L H V C S Q Z, abs + rel) → closed contours of cubic vertices with absolute handles. */
function parseD(d: string): V[][] {
  const tok = d.match(/[MmLlHhVvCcSsQqZz]|-?(?:\d*\.\d+|\d+\.?)(?:e-?\d+)?/g) ?? [];
  const out: V[][] = []; let cur: { x: number; y: number; in: [number, number]; out: [number, number] }[] = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lc: [number, number] | null = null;
  const num = () => +tok[i++];
  const close = () => {
    if (cur.length > 1) { const a = cur[0], b = cur[cur.length - 1]; if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-3) { a.in = b.in; cur.pop(); } }
    if (cur.length > 2) out.push(cur); cur = [];
  };
  const seg = (c1: [number, number], c2: [number, number], px: number, py: number) => {
    cur[cur.length - 1].out = c1; cur.push({ x: px, y: py, in: c2, out: [px, py] }); x = px; y = py;
  };
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M': { close(); x = ox + num(); y = oy + num(); sx = x; sy = y; cur.push({ x, y, in: [x, y], out: [x, y] }); cmd = rel ? 'l' : 'L'; lc = null; break; }
      case 'L': { const px = ox + num(), py = oy + num(); seg([x, y], [px, py], px, py); lc = null; break; }
      case 'H': { const px = ox + num(); seg([x, y], [px, y], px, y); lc = null; break; }
      case 'V': { const py = oy + num(); seg([x, y], [x, py], x, py); lc = null; break; }
      case 'C': { const c1: [number, number] = [ox + num(), oy + num()], c2: [number, number] = [ox + num(), oy + num()]; seg(c1, c2, ox + num(), oy + num()); lc = c2; break; }
      case 'S': { const c1: [number, number] = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y]; const c2: [number, number] = [ox + num(), oy + num()]; seg(c1, c2, ox + num(), oy + num()); lc = c2; break; }
      case 'Q': { const q: [number, number] = [ox + num(), oy + num()], px = ox + num(), py = oy + num();
        seg([x + 2 / 3 * (q[0] - x), y + 2 / 3 * (q[1] - y)], [px + 2 / 3 * (q[0] - px), py + 2 / 3 * (q[1] - py)], px, py); lc = null; break; }
      case 'Z': { if (Math.hypot(x - sx, y - sy) > 1e-3) seg([x, y], [sx, sy], sx, sy); close(); x = sx; y = sy; lc = null; break; }
      default: i++;
    }
  }
  close();
  return out;
}
/** All <path>s of <g id="…"> in an SVG file, in paint order. */
function svgGroup(svg: string, id: string): PathEl[] {
  const g = svg.match(new RegExp(`<g id="${id}"[^>]*>([\\s\\S]*?)</g>`));
  if (!g) throw new Error('no group ' + id);
  return [...g[1].matchAll(/<path\b([^>]*)\/>/g)].map(m => {
    const a = (k: string) => m[1].match(new RegExp(`\\s${k}="([^"]*)"`))?.[1];
    const fill = a('fill'), stroke = a('stroke');
    return { d: a('d')!, fill: fill && fill !== 'none' ? argb(fill) : null, stroke: stroke ? { color: argb(stroke), width: +(a('stroke-width') ?? 1) } : undefined };
  });
}
function bbox(els: PathEl[]) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const e of els) for (const c of parseD(e.d)) for (const v of c) { const p = v as { x: number; y: number }; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// ── scene tree, authored back-to-front like the SVG, emitted front-to-back (Rive draws the first child on top) ──
type Item = { kind: 'paths'; els: PathEl[] } | { kind: 'node'; name: string; pivot?: [number, number]; props?: Props; solo?: boolean; kids: Item[]; clip?: V[] };
const node = (name: string, kids: Item[], pivot?: [number, number], extra: Partial<Item & { kind: 'node' }> = {}): Item => ({ kind: 'node', name, pivot, kids, ...extra });
const paths = (els: PathEl[]): Item => ({ kind: 'paths', els });

export function buildMascot3(): { model: RigModel; nodes: Record<string, number>; stateMachine: StateMachine } {
  const parts = read('out/mascot_parts.svg'), variants = read('out/mascot_variants.svg');
  const P = (id: string) => svgGroup(parts, id), Vr = (id: string) => svgGroup(variants, id);
  const body = JSON.parse(read('rig3/stand_body.json')) as { layers: { color: string; contours: { x: number; y: number; in: [number, number]; out: [number, number] }[][] }[] };

  const G = 975;                      // ground line (stand feet)
  const NECK: [number, number] = [628, 540];
  const AXIS = 628;
  const mirror = (els: PathEl[]): PathEl[] => els.map(e => ({ ...e, d: mirrorD(e.d, AXIS) }));
  const piv = (id: string, at: 'base' | 'center' | 'topR' | 'topL' | 'top', els = P(id)): [number, number] => {
    const b = bbox(els);
    return at === 'center' ? [b.cx, b.cy] : at === 'base' ? [b.cx, b.y1 - (b.y1 - b.y0) * 0.15] : at === 'topR' ? [b.x1 - 20, b.y0 + 20] : at === 'topL' ? [b.x0 + 20, b.y0 + 20] : [b.cx, b.y0 + 25];
  };
  const eyes = (sfx: string) => [node('eyeL' + sfx, [paths(P('eye_L'))], piv('eye_L', 'center')), node('eyeR' + sfx, [paths(P('eye_R'))], piv('eye_R', 'center'))];
  const face = (sfx: string, mouth: Item) => [...eyes(sfx), paths(P('blush_L')), paths(P('blush_R')), paths(P('nose')), mouth];
  const ears = (sfx: string) => [node('earL' + sfx, [paths(P('ear_L'))], piv('ear_L', 'base')), node('earR' + sfx, [paths(P('ear_R'))], piv('ear_R', 'base'))];

  // stand: traced body, then the original collar, head (flat left cheek completed by its mirror), face, medal
  const standBody: PathEl[] = body.layers.map(l => ({ d: l.contours.map(c => `M${c[0].x},${c[0].y}` + c.map((p, i) => { const q = c[(i + 1) % c.length]; return `C${p.out[0]},${p.out[1]} ${q.in[0]},${q.in[1]} ${q.x},${q.y}`; }).join('') + 'Z').join(''), fill: argb(l.color) }));
  const KEEP: V[] = [[0, 0], [1254, 0], [1254, 1254], [480, 1254], [480, 320], [0, 320]];
  const stand = node('stand', [
    paths(standBody), paths(P('collar')),
    node('headS', [...ears('S'), paths(mirror(P('head'))), node('headKeep', [paths(P('head'))], undefined, { clip: KEEP }), ...face('S', paths(Vr('mouth_closed')))], NECK),
    paths(P('medal')),
  ]);
  // fly: the original, part for part
  const fly = node('fly', [
    node('speed', [paths(P('fx_speedlines'))], [628, 1000]),
    node('capeL', [paths(P('cape_L'))], piv('cape_L', 'topR')), node('capeR', [paths(P('cape_R'))], piv('cape_R', 'topL')), paths(P('cape_mid')),
    node('legL', [paths(P('leg_L'))], piv('leg_L', 'top')), node('legR', [paths(P('leg_R'))], piv('leg_R', 'top')),
    paths(P('torso')),
    node('armR', [paths(P('arm_R_upper')), paths(P('hand_R'))], [770, 610]),
    paths(P('collar')),
    node('fist', [paths(P('arm_L')), paths(P('hand_L'))], [480, 575]),
    node('headF', [...ears('F'), paths(P('head')), ...face('F', node('mouthSolo', [node('mouthOpen', [paths(P('mouth'))]), node('mouthMid', [paths(Vr('mouth_mid'))])], undefined, { solo: true }))], NECK),
    paths(P('medal')),
  ]);
  const shadowB = bbox(P('fx_shadow'));
  const scene = node('scene', [
    node('shadow', [paths(P('fx_shadow'))], [shadowB.cx, shadowB.cy], { props: { x: AXIS, y: G + 8 } }),
    node('root', [node('poseSolo', [stand, fly], undefined, { solo: true })], [AXIS, G]),
  ]);

  // ── emit ──
  const b = new RigBuilder(1254, 1254);
  const ids: Record<string, number> = {};
  const emit = (it: Item, parent: number) => {
    if (it.kind === 'paths') {
      for (const e of [...it.els].reverse()) {
        const s = b.shape(parent);
        for (const c of parseD(e.d)) b.path(s, c);
        if (e.stroke) b.stroke(s, e.stroke.color, e.stroke.width);
        if (e.fill != null) b.fill(s, e.fill);
      }
      return;
    }
    // pivot: outer node sits at the pivot (animated), inner node shifts the art back by −pivot
    const [px, py] = it.pivot ?? [0, 0];
    const outer = it.solo ? b.solo(parent, it.props ?? {}) : b.node(parent, { x: px, y: py, ...(it.props ?? {}) });
    ids[it.name] = outer;
    const inner = it.pivot ? b.node(outer, { x: -px, y: -py }) : outer;
    if (it.clip) { const cs = b.shape(inner); b.path(cs, it.clip); b.clip(inner, cs); }
    for (const k of [...it.kids].reverse()) emit(k, inner);
    if (it.solo) b.c[outer].p.activeComponentId = ids[(it.kids[0] as { name: string }).name];
  };
  emit(scene, 0);
  // solo children were emitted in reverse, so resolve active ids after emission
  b.c[ids.poseSolo].p.activeComponentId = ids.stand;
  b.c[ids.mouthSolo].p.activeComponentId = ids.mouthOpen;

  // ── animations (60 fps) ──
  const R = Math.PI / 180;
  const easeIO = b.cubicEase(0.42, 0, 0.58, 1), easeIn = b.cubicEase(0.5, 0, 0.9, 0.5), easeOut = b.cubicEase(0.1, 0.6, 0.4, 1);
  const n = ids, AIR = -120;
  const rot = (fr: [number, number, (number | 'linear' | 'hold')?][]) => ({ rotation: fr.map(([f, d, e]) => [f, d * R, e ?? easeIO] as F) });
  const pose = (fr: [number, 'stand' | 'fly'][]) => ({ [n.poseSolo]: { activeComponentId: fr.map(([f, k]) => [f, n[k], 'hold'] as F) } });
  const mouth = (fr: [number, 'mouthOpen' | 'mouthMid'][]) => ({ [n.mouthSolo]: { activeComponentId: fr.map(([f, k]) => [f, n[k], 'hold'] as F) } });
  const shadow = (fr: [number, number, (number | 'linear' | 'hold')?][]) => ({ [n.shadow]: { scaleX: fr.map(([f, k, e]) => [f, k, e ?? easeIO] as F), scaleY: fr.map(([f, k, e]) => [f, k, e ?? easeIO] as F), opacity: fr.map(([f, k, e]) => [f, 0.3 + 0.7 * k, e ?? easeIO] as F) } });
  const body3 = (fr: [number, number, number, number, (number | 'linear' | 'hold')?][]) => ({ [n.root]: {   // [frame, y, scaleX, scaleY]
    y: fr.map(([f, y, , , e]) => [f, G + y, e ?? easeIO] as F), scaleX: fr.map(([f, , sx, , e]) => [f, sx, e ?? easeIO] as F), scaleY: fr.map(([f, , , sy, e]) => [f, sy, e ?? easeIO] as F) } });

  b.animation('stand', 60, 150, {                                   // breathing idle, head sways, ears twitch
    ...pose([[0, 'stand']]), ...body3([[0, 0, 1, 1], [75, 0, 0.992, 1.014], [150, 0, 1, 1]]), ...shadow([[0, 1], [75, 0.99], [150, 1]]),
    [n.headS]: rot([[0, 0], [75, 1.6], [150, 0]]),
    [n.earLS]: rot([[0, 0], [96, 0], [102, -7], [110, 0], [150, 0]]), [n.earRS]: rot([[0, 0], [100, 0], [106, 7], [114, 0], [150, 0]]),
  }, 1);
  b.animation('launch', 60, 60, {                                   // crouch → swap at the stretch → rise → settle into hover
    ...pose([[0, 'stand'], [15, 'fly']]), ...mouth([[0, 'mouthMid'], [24, 'mouthOpen']]),
    ...body3([[0, 0, 1, 1], [14, 0, 1.1, 0.86, easeIn], [15, -30, 0.9, 1.14, 'linear'], [32, AIR - 34, 0.98, 1.03, easeOut], [46, AIR + 6, 1.01, 0.99], [60, AIR, 1, 1]]),
    ...shadow([[0, 1], [14, 1.08, easeIn], [32, 0.58, easeOut], [60, 0.62]]),
    [n.headS]: rot([[0, 0], [14, -2]]),
    [n.capeL]: rot([[0, 0], [15, -12, 'linear'], [32, 6, easeOut], [48, -3], [60, 0]]), [n.capeR]: rot([[0, 0], [15, 12, 'linear'], [32, -6, easeOut], [48, 3], [60, 0]]),
    [n.fist]: rot([[0, 0], [15, 10, 'linear'], [34, -4, easeOut], [60, 0]]),
    [n.legL]: rot([[0, 0], [15, 10, 'linear'], [36, -3, easeOut], [60, 0]]), [n.legR]: rot([[0, 0], [15, -8, 'linear'], [36, 3, easeOut], [60, 0]]),
    [n.speed]: { opacity: [[0, 0], [15, 0, 'hold'], [30, 1], [60, 1]] },
  });
  b.animation('fly', 60, 120, {                                     // hover loop: bob, cape flutter, fist pump, dangling legs
    ...pose([[0, 'fly']]), ...mouth([[0, 'mouthOpen']]),
    ...body3([[0, AIR, 1, 1], [60, AIR - 18, 1, 1], [120, AIR, 1, 1]]), ...shadow([[0, 0.62], [60, 0.55], [120, 0.62]]),
    [n.capeL]: rot([[0, 0], [30, 4], [90, -4], [120, 0]]), [n.capeR]: rot([[0, 0], [30, -4], [90, 4], [120, 0]]),
    [n.fist]: rot([[0, 0], [60, -3], [120, 0]]), [n.armR]: rot([[0, 0], [60, 3], [120, 0]]),
    [n.legL]: rot([[0, 0], [40, 4], [100, -2], [120, 0]]), [n.legR]: rot([[0, 0], [50, -4], [110, 2], [120, 0]]),
    [n.headF]: rot([[0, 0], [60, -1.5], [120, 0]]),
    [n.earLF]: rot([[0, 0], [70, -5], [120, 0]]), [n.earRF]: rot([[0, 0], [70, 5], [120, 0]]),
    [n.speed]: { opacity: [[0, 1], [30, 0.55], [60, 1], [90, 0.55], [120, 1]], y: [[0, 1000], [60, 1012], [120, 1000]] },
  }, 1);
  b.animation('land', 60, 54, {                                     // drop → swap at contact → squash → settle
    ...pose([[0, 'fly'], [16, 'stand']]), ...mouth([[0, 'mouthOpen'], [8, 'mouthMid']]),
    ...body3([[0, AIR, 1, 1], [15, -6, 0.95, 1.07, easeIn], [16, 0, 1.12, 0.86, 'linear'], [30, 0, 0.98, 1.03, easeOut], [42, 0, 1.005, 0.995], [54, 0, 1, 1]]),
    ...shadow([[0, 0.62], [16, 1.06, easeIn], [30, 1], [54, 1]]),
    [n.capeL]: rot([[0, 0], [15, 5, easeIn]]), [n.capeR]: rot([[0, 0], [15, -5, easeIn]]),
    [n.legL]: rot([[0, 0], [15, -6, easeIn]]), [n.legR]: rot([[0, 0], [15, 6, easeIn]]),
    [n.headS]: rot([[16, 2.5], [34, -1], [54, 0]]),
    [n.speed]: { opacity: [[0, 1], [10, 0]] },
  });
  const blink = (eye: number) => ({ scaleY: [[0, 1], [170, 1], [174, 0.1, 'linear'], [180, 1, easeOut], [240, 1]] as F[] });
  b.animation('blink', 60, 240, { [n.eyeLS]: blink(0), [n.eyeRS]: blink(0), [n.eyeLF]: blink(0), [n.eyeRF]: blink(0) }, 1);

  const stateMachine: StateMachine = {
    name: 'mascot', inputs: [{ name: 'launch', type: 'trigger' }, { name: 'land', type: 'trigger' }],
    layers: [
      { name: 'body', entry: 'stand',
        states: [{ name: 'stand', animation: 'stand' }, { name: 'launch', animation: 'launch' }, { name: 'fly', animation: 'fly' }, { name: 'land', animation: 'land' }],
        transitions: [
          { from: 'stand', to: 'launch', duration: 0.05, conditions: [{ input: 'launch' }] },
          { from: 'launch', to: 'fly', duration: 0.1, exitTime: 1 },
          { from: 'fly', to: 'land', duration: 0.1, conditions: [{ input: 'land' }] },
          { from: 'land', to: 'stand', duration: 0.1, exitTime: 1 },
        ] },
      { name: 'face', entry: 'blink', states: [{ name: 'blink', animation: 'blink' }], transitions: [] },
    ],
  };
  return { model: b.build(), nodes: ids, stateMachine };
}

/** Mirror path data about x = axis (rewrites coordinates; works for the absolute/relative commands parseD reads). */
function mirrorD(d: string, axis: number): string {
  return parseD(d).map(c => {
    const m = (p: [number, number]) => `${2 * axis - p[0]},${p[1]}`;
    const vs = c as { x: number; y: number; in: [number, number]; out: [number, number] }[];
    return `M${m([vs[0].x, vs[0].y])}` + vs.map((p, i) => { const q = vs[(i + 1) % vs.length]; return `C${m(p.out)} ${m(q.in)} ${m([q.x, q.y])}`; }).join('') + 'Z';
  }).join('');
}
