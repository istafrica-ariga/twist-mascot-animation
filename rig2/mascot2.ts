// The Twist mascot, redrawn from scratch for animation (cut-out puppet construction).
// Reference only: the user's PNG / traced SVG / video — measured for proportions and palette, no paths reused.
//
// Construction rules (how a character is drawn to MOVE):
//  • every part is a complete piece with round joints — upper arm, forearm, paw, legs, ears, cape panels;
//  • neutral base pose: arms and legs hang straight down; every pose is rotation (+ foreshortening scale) of it;
//  • a limb draws all its outlines first, then all its fills, so its joints merge into one silhouette;
//  • legs + torso likewise merge (crotch crease drawn on top); arm roots hide under the collar, which drapes over
//    the shoulders; ears sit behind the head.
// Coordinates: the reference's 1254 × 1254 space.
import { RigBuilder, type V } from '../twist-rig/src/builder';
import type { RigModel } from '../twist-rig/src/types';
import type { StateMachine } from '../twist-rig/src/state-machine';

// ── palette (sampled from the reference) ──
const C = {
  ink: 0xff260554, skin: 0xffd58cf4, shade: 0xffb772e9, blush: 0xffecb4f8, noseHi: 0xff8c70a8,
  tongue: 0xfffe84c7, tongueDk: 0xffed63a6, tooth: 0xfffefefe, toothSh: 0xffe1e0e1,
  cape: 0xfffb282b, capeMid: 0xffe62329, capeDk: 0xffc31a23,
  gold: 0xfffecd31, goldDk: 0xfff39810, goldHi: 0xfffdf1b0, shadow: 0xffe6dbfb, white: 0xffffffff,
};
const OUT = 36;            // outline stroke (visible ≈ 18 outside the fill)
const AXIS = 630;          // body centre line for mirrored parts

// ── drawing helpers ──
type Pt = [number, number] | [number, number, 'c']; // 'c' = sharp corner
/** Closed smooth contour through points (Catmull–Rom → cubic), with optional sharp corners. */
function smooth(pts: Pt[], k = 1 / 6, closed = true): V[] {
  const n = pts.length;
  return pts.map((p, i) => {
    if (p[2] === 'c' || (!closed && (i === 0 || i === n - 1))) return { x: p[0], y: p[1], in: [p[0], p[1]], out: [p[0], p[1]] };
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const tx = (b[0] - a[0]) * k, ty = (b[1] - a[1]) * k;
    return { x: p[0], y: p[1], in: [p[0] - tx, p[1] - ty], out: [p[0] + tx, p[1] + ty] };
  });
}
const K = 0.5523;
function ellipse(cx: number, cy: number, rx: number, ry: number): V[] {
  return [
    { x: cx, y: cy - ry, in: [cx - rx * K, cy - ry], out: [cx + rx * K, cy - ry] },
    { x: cx + rx, y: cy, in: [cx + rx, cy - ry * K], out: [cx + rx, cy + ry * K] },
    { x: cx, y: cy + ry, in: [cx + rx * K, cy + ry], out: [cx - rx * K, cy + ry] },
    { x: cx - rx, y: cy, in: [cx - rx, cy + ry * K], out: [cx - rx, cy - ry * K] },
  ];
}
/** Limb segment: a capsule from (x0,y0) to (x1,y1), radius r0 at the start and r1 at the end (round joints). */
function capsule(x0: number, y0: number, x1: number, y1: number, r0: number, r1 = r0): V[] {
  const L = Math.hypot(x1 - x0, y1 - y0), dx = (x1 - x0) / L, dy = (y1 - y0) / L, nx = -dy, ny = dx;
  const P = (x: number, y: number, ix: number, iy: number, ox: number, oy: number): V => ({ x, y, in: [ix, iy], out: [ox, oy] });
  const a = [x0 - nx * r0, y0 - ny * r0], tip0 = [x0 - dx * r0, y0 - dy * r0], b = [x0 + nx * r0, y0 + ny * r0];
  const c = [x1 + nx * r1, y1 + ny * r1], tip1 = [x1 + dx * r1, y1 + dy * r1], d = [x1 - nx * r1, y1 - ny * r1];
  const k0 = K * r0, k1 = K * r1;
  return [
    P(a[0], a[1], a[0] + dx * k0, a[1] + dy * k0, a[0] - dx * k0, a[1] - dy * k0),
    P(tip0[0], tip0[1], tip0[0] - nx * k0, tip0[1] - ny * k0, tip0[0] + nx * k0, tip0[1] + ny * k0),
    P(b[0], b[1], b[0] - dx * k0, b[1] - dy * k0, b[0] + dx * k0, b[1] + dy * k0),
    P(c[0], c[1], c[0] - dx * k1, c[1] - dy * k1, c[0] + dx * k1, c[1] + dy * k1),
    P(tip1[0], tip1[1], tip1[0] + nx * k1, tip1[1] + ny * k1, tip1[0] - nx * k1, tip1[1] - ny * k1),
    P(d[0], d[1], d[0] + dx * k1, d[1] + dy * k1, d[0] - dx * k1, d[1] - dy * k1),
  ];
}
const mirror = (vs: V[]): V[] => vs.map(v => {
  const o = v as { x: number; y: number; in: [number, number]; out: [number, number] };
  return { x: 2 * AXIS - o.x, y: o.y, in: [2 * AXIS - o.in[0], o.in[1]], out: [2 * AXIS - o.out[0], o.out[1]] };
});
const mirrorPts = (pts: Pt[]): Pt[] => pts.map(p => (p[2] ? [2 * AXIS - p[0], p[1], p[2]] : [2 * AXIS - p[0], p[1]]) as Pt);

// ── the drawing (neutral pose) ──
// LEFT = screen left. Right-side parts are mirrors.
const ART = {
  shadow: ellipse(630, 1162, 140, 24),
  cape: smooth([[512, 590, 'c'], [450, 620], [365, 668], [285, 712], [220, 746, 'c'], [254, 776], [292, 806], [330, 838], [372, 862], [420, 878], [470, 888], [550, 886], [580, 700]]),
  capeFold1: smooth([[448, 642], [470, 710], [480, 800], [472, 884, 'c'], [430, 872, 'c'], [436, 770], [424, 694]]),
  capeFold2: smooth([[342, 694], [364, 750], [366, 846, 'c'], [330, 834, 'c'], [332, 760]]),
  leg: smooth([[494, 760], [606, 760], [606, 870], [610, 945], [602, 986], [574, 1006], [526, 1006], [498, 986], [490, 945], [494, 870]]),
  legHi: smooth([[548, 800], [588, 820], [592, 900], [580, 960], [554, 968], [540, 900]]),
  toes: [smooth([[532, 1004], [534, 990], [538, 978]], 1 / 6, false), smooth([[568, 1004], [566, 990], [562, 978]], 1 / 6, false)],
  torso: smooth([[630, 560], [722, 566], [774, 602], [796, 662], [800, 742], [790, 802], [760, 842], [700, 860], [630, 864], [560, 860], [500, 842], [470, 802], [460, 742], [464, 662], [486, 602], [538, 566]]),
  belly: smooth([[630, 598], [712, 612], [752, 680], [744, 768], [696, 818], [630, 830], [564, 818], [516, 768], [508, 680], [548, 612]]),
  crease: smooth([[592, 840], [630, 852], [668, 840]], 1 / 6, false),
  upperArm: capsule(500, 598, 500, 712, 34, 32),
  foreArm: capsule(500, 712, 500, 818, 32, 30),
  paw: smooth([[450, 838], [500, 818], [550, 838], [562, 872], [544, 908], [500, 920], [456, 908], [438, 872]]),
  claws: [smooth([[480, 920], [482, 905], [486, 890]], 1 / 6, false), smooth([[520, 920], [518, 905], [514, 890]], 1 / 6, false)],
  ear: smooth([[548, 204], [508, 176], [462, 156], [406, 134, 'c'], [398, 182], [406, 236], [430, 282], [476, 304]]),
  earIn: smooth([[512, 198], [466, 170], [420, 152, 'c'], [420, 200], [436, 246], [472, 272]]),
  head: smooth([[560, 168], [588, 156], [598, 136, 'c'], [618, 160], [652, 132, 'c'], [672, 162], [704, 168], [772, 184], [822, 224], [850, 290], [862, 370], [860, 450], [844, 510], [854, 530, 'c'], [822, 540], [798, 556], [738, 572], [630, 582], [522, 572], [462, 556], [438, 540], [406, 530, 'c'], [416, 510], [400, 450], [398, 370], [410, 290], [438, 224], [488, 184]]),
  headShade: smooth([[796, 222], [842, 300], [856, 400], [848, 488], [816, 544], [786, 560], [818, 484], [828, 400], [818, 312]]),
  eye: ellipse(520, 290, 42, 53), eyeHi: ellipse(535, 272, 11, 11),
  blush: ellipse(503, 350, 32, 10),
  nose: ellipse(628, 332, 62, 24), noseHi: ellipse(628, 324, 20, 7),
  mouth: smooth([[472, 388], [520, 375], [632, 371], [745, 375], [798, 390], [785, 452], [740, 512], [632, 545], [528, 514], [484, 456]]),
  tongue: smooth([[566, 506], [592, 478], [632, 486], [672, 478], [698, 506], [688, 533], [632, 543], [576, 533]]),
  tongueHi: smooth([[606, 506], [632, 500], [658, 506], [664, 524], [632, 534], [600, 524]]),
  tooth: smooth([[512, 375, 'c'], [561, 375, 'c'], [561, 398], [553, 413], [520, 413], [512, 398]]),
  toothSh: smooth([[514, 377, 'c'], [527, 377, 'c'], [527, 411], [519, 410], [514, 399]]),
  lip: smooth([[486, 364, 'c'], [508, 376], [632, 381], [756, 376], [778, 364, 'c'], [756, 370], [632, 375], [508, 370]]),
  collar: smooth([[466, 552, 'c'], [550, 580], [630, 592], [710, 580], [794, 552, 'c'], [800, 572], [790, 588], [710, 610], [630, 622], [550, 610], [470, 588], [460, 572]]),
  collarFold: smooth([[540, 600], [630, 612], [720, 600], [716, 608], [630, 618], [544, 608]]),
  medal: ellipse(628, 602, 30, 30), medalRing: ellipse(628, 602, 19, 19), medalIn: ellipse(628, 602, 12, 12), medalHi: ellipse(617, 588, 8, 4),
};
// half-open / closed mouth variants, derived from the open one (scaled from the lip line)
const squashY = (vs: V[], k: number, top = 371): V[] => vs.map(v => {
  const o = v as { x: number; y: number; in: [number, number]; out: [number, number] };
  const f = (y: number) => top + (y - top) * k;
  return { x: o.x, y: f(o.y), in: [o.in[0], f(o.in[1])], out: [o.out[0], f(o.out[1])] };
});
const shiftY = (vs: V[], dy: number): V[] => vs.map(v => { const o = v as { x: number; y: number; in: [number, number]; out: [number, number] }; return { x: o.x, y: o.y + dy, in: [o.in[0], o.in[1] + dy], out: [o.out[0], o.out[1] + dy] }; });

export interface Mascot2 { model: RigModel; bones: Record<string, number>; nodes: Record<string, number>; stateMachine: StateMachine }

export function buildMascot2(): Mascot2 {
  const b = new RigBuilder(1254, 1254);
  const root = b.node(0, {});
  // ── skeleton (neutral pose) ──
  const torso = b.rootBoneAt(root, [630, 840], [630, 580]);
  const head = b.boneTo(torso, [630, 300]);
  const bones: Record<string, number> = { torso, head };
  bones.earL = b.rootBoneAt(head, [480, 250], [390, 114]); bones.earR = b.rootBoneAt(head, [780, 250], [870, 114]);
  bones.eyeL = b.rootBoneAt(head, [520, 343], [520, 237]); bones.eyeR = b.rootBoneAt(head, [740, 343], [740, 237]);
  bones.armL_up = b.rootBoneAt(torso, [500, 598], [500, 712]); bones.armL_lo = b.boneTo(bones.armL_up, [500, 818]); bones.handL = b.boneTo(bones.armL_lo, [500, 908]);
  bones.armR_up = b.rootBoneAt(torso, [760, 598], [760, 712]); bones.armR_lo = b.boneTo(bones.armR_up, [760, 818]); bones.handR = b.boneTo(bones.armR_lo, [760, 908]);
  bones.legL = b.rootBoneAt(torso, [550, 790], [550, 1004]); bones.legR = b.rootBoneAt(torso, [710, 790], [710, 1004]);
  bones.capeL_1 = b.rootBoneAt(torso, [512, 590], [365, 668]); bones.capeL_2 = b.boneTo(bones.capeL_1, [220, 746]);
  bones.capeR_1 = b.rootBoneAt(torso, [748, 590], [895, 668]); bones.capeR_2 = b.boneTo(bones.capeR_1, [1040, 746]);

  const mouthSolo = b.solo(root);
  const mouthNodes = { open: b.node(mouthSolo), mid: b.node(mouthSolo), closed: b.node(mouthSolo) };
  b.c[mouthSolo].p.activeComponentId = mouthNodes.open;
  const SH = { x: 630, y: 1162 };
  const fxShadow = b.node(0, { x: SH.x, y: SH.y }), fxShadowArt = b.node(fxShadow, { x: -SH.x, y: -SH.y });

  // ── draw list, back → front ──
  type Item = { v: V[] | V[][]; fill?: number; stroke?: number; open?: boolean; bones?: number[]; parent?: number };
  const items: Item[] = [];
  const add = (it: Item) => items.push(it);
  const piece = (v: V[], fill: number, bonesOf: number[], stroke = OUT) => { add({ v, stroke, bones: bonesOf }); add({ v, fill, bones: bonesOf }); };
  const L = (s: string) => bones[s];

  add({ v: ART.shadow, fill: C.shadow, parent: fxShadowArt });
  for (const side of ['L', 'R'] as const) {                                   // cape panels, behind everything
    const m = side === 'R' ? mirror : (x: V[]) => x, cb = [L(`cape${side}_1`), L(`cape${side}_2`)];
    piece(m(ART.cape), C.cape, cb, 30);
    add({ v: m(ART.capeFold1), fill: C.capeDk, bones: cb }); add({ v: m(ART.capeFold2), fill: C.capeMid, bones: cb });
  }
  // body: legs + torso outlines first, then fills → one merged silhouette
  add({ v: ART.leg, stroke: OUT, bones: [L('legL')] }); add({ v: mirror(ART.leg), stroke: OUT, bones: [L('legR')] });
  add({ v: ART.torso, stroke: OUT, bones: [torso] });
  add({ v: ART.upperArm, stroke: OUT, bones: [L('armL_up')] }); add({ v: mirror(ART.upperArm), stroke: OUT, bones: [L('armR_up')] });
  add({ v: ART.leg, fill: C.shade, bones: [L('legL')] }); add({ v: mirror(ART.leg), fill: C.shade, bones: [L('legR')] });
  add({ v: ART.legHi, fill: C.skin, bones: [L('legL')] }); add({ v: mirror(ART.legHi), fill: C.skin, bones: [L('legR')] });
  for (const t of ART.toes) { add({ v: t, stroke: 7, open: true, bones: [L('legL')] }); add({ v: mirror(t), stroke: 7, open: true, bones: [L('legR')] }); }
  add({ v: ART.torso, fill: C.shade, bones: [torso] });
  add({ v: ART.belly, fill: C.skin, bones: [torso] });
  add({ v: ART.upperArm, fill: C.skin, bones: [L('armL_up')] }); add({ v: mirror(ART.upperArm), fill: C.skin, bones: [L('armR_up')] });
  add({ v: ART.crease, stroke: 8, open: true, bones: [torso] });
  // arms: each arm's outlines (upper, fore, paw) then its fills, so elbows and wrists merge
  for (const side of ['R', 'L'] as const) {
    const m = side === 'R' ? mirror : (x: V[]) => x, up = [L(`arm${side}_up`)], lo = [L(`arm${side}_lo`)], hand = [L(`hand${side}`)];
    add({ v: m(ART.foreArm), stroke: OUT, bones: lo }); add({ v: m(ART.paw), stroke: OUT, bones: hand });
    add({ v: m(ART.foreArm), fill: C.skin, bones: lo }); add({ v: m(ART.paw), fill: C.skin, bones: hand }); void up;
    for (const cl of ART.claws) add({ v: m(cl), stroke: 7, open: true, bones: hand });
  }
  // head: ears behind, then head, shading, face
  for (const side of ['L', 'R'] as const) {
    const m = side === 'R' ? mirror : (x: V[]) => x, eb = [L(`ear${side}`)];
    piece(m(ART.ear), C.skin, eb); add({ v: m(ART.earIn), fill: C.shade, bones: eb });
  }
  piece(ART.head, C.skin, [head]);
  add({ v: ART.headShade, fill: C.shade, bones: [head] });
  for (const side of ['L', 'R'] as const) {
    const m = side === 'R' ? mirror : (x: V[]) => x, eye = [L(`eye${side}`)];
    add({ v: m(ART.blush), fill: C.blush, bones: [head] });
    add({ v: m(ART.eye), fill: C.ink, bones: eye });
    // highlight stays upper-right on both eyes (same light), so it is shifted, not mirrored
    add({ v: side === 'L' ? ART.eyeHi : shiftX(ART.eyeHi, 220), fill: C.white, bones: eye });
  }
  add({ v: ART.nose, fill: C.ink, bones: [head] }); add({ v: ART.noseHi, fill: C.noseHi, bones: [head] });
  // mouths (Solo): open / half-open / closed
  const teeth = (parent: number) => {
    for (const side of ['L', 'R'] as const) {
      const m = side === 'R' ? (v: V[]) => shiftX(v, 188) : (x: V[]) => x;
      add({ v: m(ART.tooth), fill: C.tooth, bones: [head], parent }); add({ v: m(ART.toothSh), fill: C.toothSh, bones: [head], parent });
    }
  };
  add({ v: ART.mouth, fill: C.ink, bones: [head], parent: mouthNodes.open });
  add({ v: ART.tongue, fill: C.tongueDk, bones: [head], parent: mouthNodes.open }); add({ v: ART.tongueHi, fill: C.tongue, bones: [head], parent: mouthNodes.open });
  teeth(mouthNodes.open);
  add({ v: squashY(ART.mouth, 0.52), fill: C.ink, bones: [head], parent: mouthNodes.mid });
  add({ v: shiftY(squashY(ART.tongue, 0.6, 543), -84), fill: C.tongue, bones: [head], parent: mouthNodes.mid });
  teeth(mouthNodes.mid);
  for (const side of ['L', 'R'] as const) {                                   // closed: teeth outlined on skin
    const m = side === 'R' ? (v: V[]) => shiftX(v, 188) : (x: V[]) => x;
    add({ v: m(ART.tooth), stroke: 9, bones: [head], parent: mouthNodes.closed });
    add({ v: m(ART.tooth), fill: C.tooth, bones: [head], parent: mouthNodes.closed }); add({ v: m(ART.toothSh), fill: C.toothSh, bones: [head], parent: mouthNodes.closed });
  }
  add({ v: ART.lip, fill: C.ink, bones: [head], parent: mouthNodes.closed });
  // collar drapes over the shoulders (hides the arm roots), medal on top
  piece(ART.collar, C.cape, [torso], 22); add({ v: ART.collarFold, fill: C.capeMid, bones: [torso] });
  piece(ART.medal, C.gold, [torso], 18); add({ v: ART.medalRing, fill: C.goldDk, bones: [torso] });
  add({ v: ART.medalIn, fill: C.gold, bones: [torso] }); add({ v: ART.medalHi, fill: C.goldHi, bones: [torso] });

  // builder draws the first-added shape on top → add front-most first
  for (const it of [...items].reverse()) {
    const sh = b.shape(it.parent ?? root);
    const contours = (Array.isArray(it.v[0]) ? it.v : [it.v]) as V[][];
    for (const v of contours) { const p = b.path(sh, v, { isClosed: !it.open }); if (it.bones) b.skin(p, it.bones); }
    if (it.stroke) b.stroke(sh, C.ink, it.stroke);
    if (it.fill != null) b.fill(sh, it.fill);
  }

  // ── poses (solved from targets measured on the reference image and the video's stand frame) ──
  const aim = (pairs: [string, [number, number]][]) => b.aim(pairs.map(p => bones[p[0]]), pairs.map(p => p[1]));
  type Pose = Record<number, { rotation: number; scaleX: number }>;
  const FLY: Pose = {
    ...aim([['armL_up', [412, 506]], ['armL_lo', [338, 418]], ['handL', [300, 356]]]),     // fist to the sky, clear of the head
    ...aim([['armR_up', [792, 700]], ['armR_lo', [808, 772]], ['handR', [816, 850]]]),     // paw relaxed at the hip
    ...aim([['legL', [566, 930]]]), ...aim([['legR', [692, 1000]]]),                       // one knee lifted
  };
  const STAND: Pose = {
    ...aim([['armL_up', [446, 700]], ['armL_lo', [462, 660]], ['handL', [466, 720]]]),     // paws up at the chest
    ...aim([['armR_up', [814, 700]], ['armR_lo', [798, 660]], ['handR', [794, 720]]]),
    ...aim([['legL', [530, 1004]]]), ...aim([['legR', [730, 1004]]]),                      // feet planted apart
    ...aim([['capeL_1', [452, 712]], ['capeL_2', [420, 884]]]), ...aim([['capeR_1', [808, 712]], ['capeR_2', [840, 884]]]), // cape hangs
  };
  for (const [k, v] of Object.entries({ [torso]: 0.93, [head]: 1 / 0.93, [bones.legL]: STAND[bones.legL].scaleX * 0.88, [bones.legR]: STAND[bones.legR].scaleX * 0.88 }))
    STAND[+k] = { rotation: STAND[+k]?.rotation ?? (b.c[+k].p.rotation as number), scaleX: v };
  const TUCK: Pose = { ...aim([['legL', [575, 950]]]), ...aim([['legR', [690, 960]]]) };

  // ── animation ──
  type F = [number, number, (number | 'linear' | 'hold')?];
  const easeIO = b.cubicEase(0.42, 0, 0.58, 1), easeOut = b.cubicEase(0.16, 1, 0.3, 1), easeIn = b.cubicEase(0.6, 0, 0.84, 0);
  const base = (i: number, k: string) => (b.c[i].p[k] as number | undefined) ?? (k.startsWith('scale') ? 1 : 0);
  const R = Math.PI / 180;
  /** frames of [frame, pose] for every posed bone: rotation + scaleX (unposed bones hold the neutral) */
  const keyPoses = (frames: [number, Pose | null, (number | 'linear' | 'hold')?][]) => {
    const ids = new Set<number>(); for (const [, p] of frames) if (p) for (const k in p) ids.add(+k);
    return Object.fromEntries([...ids].map(i => [i, {
      // unwrap each key next to the rest angle so blends never swing the long way round the ±180° seam
      rotation: frames.map(([f, p, e]) => { const r0 = base(i, 'rotation'), r = p?.[i]?.rotation ?? r0; return [f, r0 + Math.atan2(Math.sin(r - r0), Math.cos(r - r0)), e ?? easeIO] as F; }),
      scaleX: frames.map(([f, p, e]) => [f, p?.[i]?.scaleX ?? 1, e ?? easeIO] as F),
    }]));
  };
  const deg = (bone: string, fr: [number, number][]) => ({ rotation: fr.map(([f, d]) => [f, base(bones[bone], 'rotation') + d * R, easeIO] as F) });
  const solo = (fr: [number, keyof typeof mouthNodes][]) => ({ [mouthSolo]: { activeComponentId: fr.map(([f, m]) => [f, mouthNodes[m], 'hold'] as F) } });
  const shadow = (fr: [number, number][]) => ({ [fxShadow]: { scaleX: fr.map(([f, k]) => [f, k, easeIO] as F), scaleY: fr.map(([f, k]) => [f, k, easeIO] as F), opacity: fr.map(([f, k]) => [f, 0.35 + 0.65 * k, easeIO] as F) } });
  const GROUND = 150, AIR = -70;

  b.animation('stand', 60, 120, {                                              // breathing idle
    ...keyPoses([[0, STAND], [120, STAND]]),
    [torso]: { scaleX: [[0, 0.93], [60, 0.95], [120, 0.93]], scaleY: [[0, 1], [60, 0.99], [120, 1]], rotation: [[0, base(torso, 'rotation')], [120, base(torso, 'rotation')]] },
    [head]: { ...deg('head', [[0, 0], [60, 1.5], [120, 0]]), scaleX: [[0, 1 / 0.93], [120, 1 / 0.93]] },
    [root]: { y: [[0, GROUND], [120, GROUND]] }, ...shadow([[0, 1], [120, 1]]), ...solo([[0, 'closed']]),
  }, 1);
  b.animation('launch', 60, 42, {                                              // anticipation → take-off → settle
    ...keyPoses([[0, STAND], [12, STAND, easeIn], [22, { ...FLY, ...TUCK }, easeOut], [42, FLY]]),
    [torso]: { scaleX: [[0, 0.93], [12, 0.84, easeIn], [22, 1.1, easeOut], [34, 0.97], [42, 1]], scaleY: [[0, 1], [12, 1.1, easeIn], [22, 0.93, easeOut], [42, 1]], rotation: [[0, base(torso, 'rotation')], [42, base(torso, 'rotation')]] },
    [head]: { scaleX: [[0, 1 / 0.93], [12, 1 / 0.84, easeIn], [22, 1 / 1.1, easeOut], [34, 1 / 0.97], [42, 1]] },
    [root]: { y: [[0, GROUND], [12, GROUND + 26, easeIn], [26, AIR - 50, easeOut], [42, AIR, easeIO]] },
    ...shadow([[0, 1], [12, 1.06], [26, 0.6], [42, 0.62]]), ...solo([[0, 'closed'], [10, 'mid'], [18, 'open']]),
  });
  b.animation('fly', 60, 120, {                                                // hover loop
    ...keyPoses([[0, FLY], [120, FLY]]),
    [root]: { y: [[0, AIR], [60, AIR - 18], [120, AIR]] },
    [bones.capeL_2]: deg('capeL_2', [[0, -4], [30, 7], [90, -7], [120, -4]]), [bones.capeR_2]: deg('capeR_2', [[0, 4], [30, -7], [90, 7], [120, 4]]),
    [bones.capeL_1]: deg('capeL_1', [[0, 0], [60, 4], [120, 0]]), [bones.capeR_1]: deg('capeR_1', [[0, 0], [60, -4], [120, 0]]),
    [bones.earL]: deg('earL', [[0, 0], [70, -6], [120, 0]]), [bones.earR]: deg('earR', [[0, 0], [70, 6], [120, 0]]),
    [head]: deg('head', [[0, 0], [60, -2], [120, 0]]),
    ...shadow([[0, 0.62], [60, 0.55], [120, 0.62]]), ...solo([[0, 'open']]),
  }, 1);
  b.animation('blink', 60, 180, {
    [bones.eyeL]: { scaleX: [[0, 1], [164, 1], [168, 0.08, 'linear'], [174, 1, easeOut], [180, 1]] },
    [bones.eyeR]: { scaleX: [[0, 1], [164, 1], [168, 0.08, 'linear'], [174, 1, easeOut], [180, 1]] },
  }, 1);
  const stateMachine: StateMachine = {
    name: 'mascot', inputs: [{ name: 'launch', type: 'trigger' }, { name: 'land', type: 'trigger' }],
    layers: [
      { name: 'body', entry: 'stand', states: [{ name: 'stand', animation: 'stand' }, { name: 'launch', animation: 'launch' }, { name: 'fly', animation: 'fly' }],
        transitions: [{ from: 'stand', to: 'launch', duration: 0.08, conditions: [{ input: 'launch' }] }, { from: 'launch', to: 'fly', duration: 0.2, exitTime: 1 }, { from: 'fly', to: 'stand', duration: 0.45, conditions: [{ input: 'land' }] }] },
      { name: 'face', entry: 'blink', states: [{ name: 'blink', animation: 'blink' }], transitions: [] },
    ],
  };
  return { model: b.build(), bones, nodes: { root, mouthSolo, fxShadow, ...mouthNodes }, stateMachine };
}
function shiftX(vs: V[], dx: number): V[] { return vs.map(v => { const o = v as { x: number; y: number; in: [number, number]; out: [number, number] }; return { x: o.x + dx, y: o.y, in: [o.in[0] + dx, o.in[1]], out: [o.out[0] + dx, o.out[1]] }; }); }
