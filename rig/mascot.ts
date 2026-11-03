// The Twist mascot as a twist-rig: clean fitted shapes (rig/parts.json, from tools/fit.mjs) + bones + skins.
// Coordinates are the trace's 1254×1254 space. Built the way the user's own Rive rig is built:
// each part = one stroked + filled silhouette (stroke under the fill), detail shapes on top, every path skinned.
import { RigBuilder, type V } from '../twist-rig/src/builder';
import type { RigModel } from '../twist-rig/src/types';
import type { StateMachine } from '../twist-rig/src/state-machine';
import partsJson from './parts.json';

type Contour = { hole?: boolean; vertices: { x: number; y: number; in: [number, number]; out: [number, number] }[] };
type Layer = { color: string; contours: Contour[]; stroke?: number };
type Part = { base: Layer; details: Layer[]; darks: Layer[]; slits: Layer[]; layers: Layer[] };
const PARTS = partsJson as unknown as Record<string, Part>;

export const OUTLINE = 0xff260554;
const argb = (hex: string) => (0xff000000 | parseInt(hex.slice(1), 16)) >>> 0;

// back → front, with outline stroke width (visible outline = half, the fill covers the inner half)
const ORDER: [string, number][] = [
  ['fx_shadow', 0], ['fx_speedlines', 0], ['cape_L', 30], ['cape_R', 30], ['cape_mid', 30], ['body', 40], ['armL', 40], ['armL_patch', 0], ['ear_L', 40],
  ['ear_R', 40], ['head', 40], ['eye_L', 0], ['eye_R', 0], ['blush_L', 0], ['blush_R', 0], ['nose', 0], ['mouth', 0], ['mouth_mid', 0], ['mouth_closed', 0],
  // collar above the chin: its own thin outline makes the thin chin/collar band of the original art
  ['collar', 24], ['medal', 20],
];

const LAYERED = new Set(['medal', 'collar']);

export interface MascotRig { model: RigModel; bones: Record<string, number>; nodes: Record<string, number>; stateMachine: StateMachine }

export function buildMascot(): MascotRig {
  const b = new RigBuilder(1254, 1254);
  const root = b.node(0, {});
  // ── skeleton ──
  const torso = b.rootBoneAt(root, [630, 800], [630, 590]);
  const head = b.boneTo(torso, [632, 300]);
  const bones: Record<string, number> = {
    torso, head,
    ear_L: b.rootBoneAt(head, [478, 240], [400, 140]), ear_R: b.rootBoneAt(head, [778, 240], [858, 140]),
    armL_up: b.rootBoneAt(torso, [495, 592], [425, 482]), armR_up: b.rootBoneAt(torso, [765, 600], [810, 652]),
    legL_up: b.rootBoneAt(torso, [540, 800], [545, 860]), legR_up: b.rootBoneAt(torso, [715, 805], [705, 895]),
    capeL_1: b.rootBoneAt(torso, [505, 575], [390, 670]), capeR_1: b.rootBoneAt(torso, [790, 590], [900, 680]),
  };
  bones.armL_lo = b.boneTo(bones.armL_up, [356, 376]);
  bones.handL = b.boneTo(bones.armL_lo, [322, 320]);
  bones.handR = b.boneTo(bones.armR_up, [822, 700]);
  bones.legL_lo = b.boneTo(bones.legL_up, [560, 915]);
  bones.legR_lo = b.boneTo(bones.legR_up, [688, 985]);
  bones.capeL_2 = b.boneTo(bones.capeL_1, [250, 745]);
  bones.capeR_2 = b.boneTo(bones.capeR_1, [1025, 760]);
  // eye bones point up from the bottom of each eye: squashing one along its length closes the eye like a lid
  bones.eyeL = b.rootBoneAt(head, [517, 344], [517, 240]);
  bones.eyeR = b.rootBoneAt(head, [737, 344], [737, 240]);
  // mouth variants under a Solo (one visible at a time)
  const mouthSolo = b.solo(root);
  const mouthNodes: Record<string, number> = { mouth: b.node(mouthSolo), mouth_mid: b.node(mouthSolo), mouth_closed: b.node(mouthSolo) };
  b.c[mouthSolo].p.activeComponentId = mouthNodes.mouth;

  const SKIN: Record<string, number[]> = {
    cape_L: [bones.capeL_1, bones.capeL_2, torso], cape_R: [bones.capeR_1, bones.capeR_2, torso], cape_mid: [torso],
    body: [torso, bones.legL_up, bones.legL_lo, bones.legR_up, bones.legR_lo, bones.armR_up, bones.handR],
    armL: [bones.armL_up, bones.armL_lo, bones.handL, torso], armL_patch: [bones.armL_up, torso],
    collar: [torso], medal: [torso], ear_L: [bones.ear_L], ear_R: [bones.ear_R],
    head: [head], eye_L: [bones.eyeL], eye_R: [bones.eyeR], blush_L: [head], blush_R: [head], nose: [head],
    mouth: [head], mouth_mid: [head], mouth_closed: [head],
  };

  // ── shapes: the builder draws the FIRST shape on top, so add front-most first ──
  const toV = (c: Contour): V[] => c.vertices.map(v => ({ x: v.x, y: v.y, in: v.in, out: v.out }));
  // stage fx stay on the stage (not under the character's root); speed lines get their own node so they can fade
  // shadow scales about its own centre: outer node sits at the centre (keyed), inner node offsets the art back
  const SH = { x: 629, y: 1163 };
  const fxLines = b.node(0, { opacity: 1 }), fxShadow = b.node(0, { x: SH.x, y: SH.y }), fxShadowArt = b.node(fxShadow, { x: -SH.x, y: -SH.y });
  const parentOf = (part: string) => part === 'fx_speedlines' ? fxLines : part === 'fx_shadow' ? fxShadowArt : mouthNodes[part] ?? root;
  const addShape = (part: string, layer: Layer, stroke: number) => {
    const sh = b.shape(parentOf(part));
    for (const c of layer.contours) { const p = b.path(sh, toV(c)); if (SKIN[part]) b.skin(p, SKIN[part]); }
    // paint order = draw order: stroke first, then the fill over its inner half
    const sw = stroke || layer.stroke || 0;
    if (sw) b.stroke(sh, OUTLINE, sw);
    b.fill(sh, argb(layer.color));
  };
  for (const [part, stroke] of [...ORDER].reverse()) {
    const p = PARTS[part]; if (!p) continue;
    if (stroke) {
      for (const l of [...p.slits].reverse()) addShape(part, l, 0);
      // layered parts keep every original layer in order (their shading is stacked); others only need the details
      for (const l of [...(LAYERED.has(part) ? p.layers : p.details)].reverse()) addShape(part, l, 0);
      addShape(part, p.base, stroke);
    } else for (const l of [...p.layers].reverse()) addShape(part, l, 0);
  }
  // ── animation ──────────────────────────────────────────────────────────────────────────────────────────
  const R = Math.PI / 180;
  const baseOf = (i: number, k: string) => (b.c[i].p[k] as number | undefined) ?? (k.startsWith('scale') ? 1 : 0);
  type F = [number, number, (number | 'linear' | 'hold')?];
  const easeIO = b.cubicEase(0.42, 0, 0.58, 1), easeOut = b.cubicEase(0.16, 1, 0.3, 1), easeIn = b.cubicEase(0.6, 0, 0.84, 0);
  const back = b.cubicEase(0.34, 1.56, 0.64, 1);
  /** rotation keys as degree deltas from the bind pose */
  const rot = (bone: string, fr: F[]) => ({ rotation: fr.map(([f, d, e]) => [f, baseOf(bones[bone], 'rotation') + d * R, e ?? easeIO] as F) });
  const scl = (bone: string, axis: 'scaleX' | 'scaleY', fr: F[]) => ({ [axis]: fr.map(([f, v, e]) => [f, v, e ?? easeIO] as F) });
  const merge = (...o: Record<string, F[]>[]) => Object.assign({}, ...o);
  // ── poses, solved from targets read off the video's stand frame (trace coordinates) ──
  // short arms bent at the sides, paws up at the chest (left mirrors right about x = 626); straight legs set apart
  // (left mirrors right); cape hanging straight down behind.
  const aim = (pairs: [string, [number, number]][]) => b.aim(pairs.map(p => bones[p[0]]), pairs.map(p => p[1]));
  const STAND_ABS: Record<number, { rotation: number; scaleX: number }> = {
    ...aim([['armL_up', [446, 690]], ['armL_lo', [462, 646]], ['handL', [465, 696]]]),   // elbow out, paw up front
    ...aim([['armR_up', [790, 646]], ['handR', [787, 696]]]),
    ...aim([['legL_up', [515, 872]], ['legL_lo', [508, 946]]]),                             // short, set wide apart
    ...aim([['legR_up', [737, 872]], ['legR_lo', [744, 946]]]),
    ...aim([['capeL_1', [432, 705]], ['capeL_2', [385, 905]]]),                             // spread, down to the feet
    ...aim([['capeR_1', [820, 705]], ['capeR_2', [867, 905]]]),
  };
  const TUCK: Record<string, number> = { legL_up: 18, legL_lo: -12, legR_up: -8, legR_lo: 10 };
  type P = 'stand' | 'base' | number; // pose at a key: stand pose, bind pose, or a degree delta from bind
  const allBones = Object.keys(bones);
  const keyed = (frames: [number, (n: string) => P, (number | 'linear' | 'hold')?][]) => Object.fromEntries(allBones.map(n => {
    const i = bones[n], st = STAND_ABS[i], base = baseOf(i, 'rotation');
    const val = (p: P) => p === 'stand' ? (st ? st.rotation : base) : p === 'base' ? base : base + p * R;
    const sc = (p: P) => p === 'stand' && st ? st.scaleX : 1;
    return [i, { rotation: frames.map(([f, fn, e]) => [f, val(fn(n)), e ?? easeIO] as F), scaleX: frames.map(([f, fn, e]) => [f, sc(fn(n)), e ?? easeIO] as F) }];
  }));
  const solo = (frames: [number, string][]) => ({ [mouthSolo]: { activeComponentId: frames.map(([f, m]) => [f, mouthNodes[m], 'hold'] as F) } });

  // ground: in the art the feet hover ~150 units above the shadow; standing puts them on it
  const GROUND = 175;
  // shadow: [frame, size] keys → scale about its centre, fading as it shrinks (the character is higher)
  const shadow = (keys: [number, number][]) => ({ [fxShadow]: {
    scaleX: keys.map(([f, k]) => [f, k, easeIO] as F), scaleY: keys.map(([f, k]) => [f, k, easeIO] as F),
    opacity: keys.map(([f, k]) => [f, 0.4 + 0.6 * k, easeIO] as F) } });
  // stand: arm down at the chest, mouth closed, breathing (torso squash/stretch along its length)
  b.animation('stand', 60, 120, {
    ...keyed([[0, () => 'stand'], [120, () => 'stand']]),
    [torso]: merge(rot('torso', [[0, 0], [120, 0]]), scl('torso', 'scaleX', [[0, 1], [60, 1.025], [120, 1]]), scl('torso', 'scaleY', [[0, 1], [60, 0.99], [120, 1]])),
    [head]: rot('head', [[0, 0], [60, 2], [120, 0]]),
    [root]: { y: [[0, GROUND], [120, GROUND]] },
    [fxLines]: { opacity: [[0, 0], [120, 0]] },
    ...shadow([[0, 1], [120, 1]]),
    ...solo([[0, 'mouth_closed']]),
  }, 1);
  // launch: crouch → stretch up as the arm swings to the sky and the mouth opens → settle into flight
  b.animation('launch', 60, 42, {
    ...keyed([[0, () => 'stand'], [12, () => 'stand'], [22, n => TUCK[n] ?? 'base', easeOut], [42, () => 'base']]),
    [torso]: merge(rot('torso', [[0, 0], [42, 0]]), scl('torso', 'scaleX', [[0, 1], [12, 0.86, easeIn], [22, 1.12, easeOut], [34, 0.97], [42, 1]]), scl('torso', 'scaleY', [[0, 1], [12, 1.1, easeIn], [22, 0.93, easeOut], [42, 1]])),
    [root]: { y: [[0, GROUND], [12, GROUND + 26, easeIn], [26, -110, easeOut], [42, -70, easeIO]] },
    [fxLines]: { opacity: [[0, 0], [14, 0], [20, 1, 'linear'], [42, 1]] },
    ...shadow([[0, 1], [12, 1.05], [26, 0.6], [42, 0.62]]),
    ...solo([[0, 'mouth_closed'], [10, 'mouth_mid'], [18, 'mouth']]),
  });
  // fly: hover bob, cape flutter, dangling legs, fist pump, ear flick (2 s loop)
  b.animation('fly', 60, 120, {
    [root]: { y: [[0, -70], [60, -88], [120, -70]] },
    [fxLines]: { opacity: [[0, 1], [120, 1]] },
    ...shadow([[0, 0.62], [60, 0.55], [120, 0.62]]),
    [bones.capeL_1]: rot('capeL_1', [[0, 0], [60, 5], [120, 0]]), [bones.capeL_2]: rot('capeL_2', [[0, -4], [30, 8], [90, -8], [120, -4]]),
    [bones.capeR_1]: rot('capeR_1', [[0, 0], [60, -5], [120, 0]]), [bones.capeR_2]: rot('capeR_2', [[0, 4], [30, -8], [90, 8], [120, 4]]),
    [bones.legL_up]: rot('legL_up', [[0, 0], [60, 6], [120, 0]]), [bones.legR_up]: rot('legR_up', [[0, 0], [60, -5], [120, 0]]),
    [bones.legL_lo]: rot('legL_lo', [[0, 0], [70, -8], [120, 0]]), [bones.legR_lo]: rot('legR_lo', [[0, 0], [70, 7], [120, 0]]),
    [bones.armL_lo]: rot('armL_lo', [[0, 0], [60, -6], [120, 0]]), [bones.handL]: rot('handL', [[0, 0], [60, 8], [120, 0]]),
    [head]: rot('head', [[0, 0], [60, -2.5], [120, 0]]),
    [bones.ear_L]: rot('ear_L', [[0, 0], [70, -7], [120, 0]]), [bones.ear_R]: rot('ear_R', [[0, 0], [70, 7], [120, 0]]),
    ...solo([[0, 'mouth']]),
  }, 1);
  // blink (face layer, 3 s loop)
  b.animation('blink', 60, 180, {
    [bones.eyeL]: scl('eyeL', 'scaleX', [[0, 1], [164, 1], [168, 0.08, 'linear'], [174, 1, easeOut], [180, 1]]),
    [bones.eyeR]: scl('eyeR', 'scaleX', [[0, 1], [164, 1], [168, 0.08, 'linear'], [174, 1, easeOut], [180, 1]]),
  }, 1);

  const stateMachine: StateMachine = {
    name: 'mascot',
    inputs: [{ name: 'launch', type: 'trigger' }, { name: 'land', type: 'trigger' }],
    layers: [
      { name: 'body', entry: 'stand', states: [{ name: 'stand', animation: 'stand' }, { name: 'launch', animation: 'launch' }, { name: 'fly', animation: 'fly' }],
        transitions: [
          { from: 'stand', to: 'launch', duration: 0.1, conditions: [{ input: 'launch' }] },
          { from: 'launch', to: 'fly', duration: 0.2, exitTime: 1 },
          { from: 'fly', to: 'stand', duration: 0.45, conditions: [{ input: 'land' }] },
        ] },
      { name: 'face', entry: 'blink', states: [{ name: 'blink', animation: 'blink' }], transitions: [] },
    ],
  };
  void back;
  return { model: b.build(), bones, nodes: { root, mouthSolo, ...mouthNodes }, stateMachine };
}
