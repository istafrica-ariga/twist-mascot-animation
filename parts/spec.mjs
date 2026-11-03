// Rig part spec for the mascot, in the trace's 1254×1254 coordinate space.
// L / R = SCREEN left / right (the raised fist is on screen-left).
//
// Each part lists:
//   paths   – trace path indices (= their line number in ref/mascot_traced.svg) taken whole
//   outline – true if the part owns a share of the trace's dark silhouette (path 2)
//   ring    – outline-completion width: the part gets a full outline of this width all round, kept only where
//             it's invisible in the rest pose (over existing dark, or under parts drawn in front)
//   variantSource – also emit a standalone version (out/mascot_solo.svg) for mirrored variants; `open` = the
//                   joint side, where its outline stays open; `trim` = where to drop original-outline slivers
//   hidden  – new art underneath parts drawn in front of this one (clipped so the rest pose can't change)
// Merged trace paths are cut per `cutOrder`: each claim takes (path ∩ region), the `rest` part gets the remainder.
// Limbs stay continuous (no elbow/wrist cut inside the arm) — Rive bends them by binding vertices to bones.

export const OUTLINE = '#260554';

const ell = (cx, cy, rx, ry) => `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;

// Joint lines (shared by neighbouring regions so pieces tile exactly).
const EAR_L_BASE = [[575, 60], [544.2, 176.3], [528.9, 196.5], [513.5, 215], [489.5, 234.8], [422.7, 289.4], [406, 288], [392, 262], [360, 230], [300, 200], [300, 60]];
const EAR_R_BASE = [[690, 60], [713.2, 176.6], [727.6, 196.7], [742.9, 215], [766.8, 234.6], [833.8, 290], [920, 290], [920, 60]];
const SHOULDER_L = [[502.5, 570.3], [488, 609.5]];            // collar edge → armpit
const SHOULDER_R = [[763, 590], [748.8, 623.1]];              // collar edge → top of the arm/torso slit
const WRIST_R = [[773.7, 657.5], [812, 646.5], [858, 667.7]]; // paw top arc → outer notch
const HIP_L = [[470, 780], [488, 789.8], [584.8, 812.8], [610, 822], [630, 830]];
const HIP_R = [[630, 830], [660, 833], [688.9, 814.8], [768.2, 804.8], [800, 800]];

export const regions = {
  ear_L: EAR_L_BASE,
  ear_R: EAR_R_BASE,
  arm_L: [[200, 250], [520, 250], [549.3, 400.1], [530, 520], ...SHOULDER_L, [475, 640], [380, 660], [300.7, 563.9]],
  hand_R: [...WRIST_R, [900, 660], [900, 790], [802, 790], [792, 760], [780, 735], [770, 712], [766, 690], [766, 672]], // stays off the torso edge below the paw
  arm_R_upper: [SHOULDER_R[1], ...WRIST_R, [900, 660], [900, 560], [775, 560], SHOULDER_R[0]],
  leg_L: [...HIP_L, [630, 1060], [470, 1060]],
  leg_R: [...HIP_R, [800, 1060], [630, 1060]],
};

export const cutOrder = {
  4: { claims: ['ear_L', 'ear_R'], rest: 'head' },
  25: { claims: ['arm_L', 'hand_R', 'arm_R_upper', 'leg_L', 'leg_R'], rest: 'torso' },
  26: { claims: ['hand_R', 'arm_R_upper'], rest: 'torso' },
};

export const AXIS = 626; // body centre line (medal, belly highlight): mirror x' = 2·AXIS − x
const CAPE_IN = '#C31A23', SKIN = '#B772E9', SKIN_LIGHT = '#D58CF4';

// Draw order, back → front.
export const parts = [
  { id: 'fx_shadow', paths: [78] },
  { id: 'fx_speedlines', paths: [79, 80, 81, 82] },
  { id: 'cape_L', paths: [39, 40, 41, 42, 43, 44, 45], outline: true,                  // no ring: the cape's inner
    hidden: [{ d: 'M470 625L560 560L640 600L640 874L507 877L470 840Z', fill: CAPE_IN },   // edges are all behind the body
             { from: 'cape_R', mirror: AXIS }] },        // shoulder under the raised arm, drawn like the right side
  { id: 'cape_R', paths: [46, 47, 48, 49, 50, 51, 52, 53], outline: true,              // bottom edge follows the
    hidden: [{ d: 'M640 555L800 555L905 640L905 885L768 884L640 874Z', fill: CAPE_IN }] }, // cape's real hem; fills the paw bite
  { id: 'cape_mid', paths: [3], outline: true },
  { id: 'leg_L', paths: [36, 37, 38], outline: true, ring: 20, hidden: [{ d: ell(548, 795, 62, 42), fill: SKIN }] },
  { id: 'leg_R', paths: [33, 34, 35], outline: true, ring: 20, variantSource: { open: [[630, 830], [660, 833], [688.9, 814.8], [768.2, 804.8], [800, 800], [800, 700], [630, 700]] }, hidden: [{ d: ell(718, 800, 62, 42), fill: SKIN }] },
  { id: 'torso', paths: [], outline: true, ring: 20,                                       // neck + shoulders
    hidden: [{ d: 'M500 610C495 545 555 500 630 500C705 500 775 530 795 600C810 660 805 740 790 810L480 810C470 740 480 680 500 610Z', fill: SKIN }] },
  { id: 'arm_R_upper', paths: [], outline: true, ring: 20, variantSource: { open: [[763, 590], [748.8, 623.1], [773.7, 657.5], [766, 672], [766, 700], [776, 723], [700, 760], [700, 560], [772, 560]], /* shoulder + the side attached to the torso */
      trim: [[700, 540], [785, 540], [783, 584], [763, 591], [752, 612], [700, 625]] /* original-outline slivers at the shoulder cut */ }, hidden: [{ d: ell(805, 690, 34, 32), fill: SKIN_LIGHT }] },
  { id: 'hand_R', paths: [27, 28, 29], outline: true, ring: 18, variantSource: { open: [[773.7, 657.5], [812, 646.5], [858, 667.7], [890, 600], [750, 600]] } },
  { id: 'collar', paths: [58, 59, 60, 61, 72, 73, 74, 75, 76, 77], outline: true, ring: 12, variantSource: {},
    hidden: [{ d: 'M585 571L672 571L672 601L585 601Z', fill: '#E62329' },                // band under the medal
             { from: 'collar', mirror: AXIS }] },        // left tail over the shoulder, under the raised arm
  { id: 'arm_L', paths: [30, 31, 32], outline: true, ring: 20, hidden: [{ d: ell(352, 372, 32, 28), fill: SKIN_LIGHT }] },
  { id: 'hand_L', paths: [54, 55, 56, 57], outline: true, ring: 20 },
  { id: 'ear_L', paths: [63], outline: true, ring: 20, hidden: [{ d: ell(480, 255, 46, 40), fill: SKIN_LIGHT }] },
  { id: 'ear_R', paths: [62], outline: true, ring: 20, hidden: [{ d: ell(775, 255, 46, 40), fill: SKIN_LIGHT }] },
  { id: 'head', paths: [5, 6, 7], outline: true, ring: 20 },
  { id: 'eye_L', paths: [15, 16, 17] }, // 16/19 = purple rim painted over the pupil's edge
  { id: 'eye_R', paths: [18, 19, 20] },
  { id: 'blush_L', paths: [24] },
  { id: 'blush_R', paths: [23] },
  { id: 'nose', paths: [21, 22] },
  { id: 'mouth', paths: [8, 9, 10, 11, 12, 13, 14] },
  { id: 'medal', paths: [64, 65, 66, 67, 68, 69, 70, 71], outline: true, ring: 10 },
];

// Rig hierarchy + pivots (used by tools/pose.mjs now, and the Rive bones later).
export const rig = {
  torso: { parent: null, pivot: [630, 760] },
  collar: { parent: 'torso' }, medal: { parent: 'torso' }, cape_mid: { parent: 'torso' },
  cape_L: { parent: 'torso', pivot: [505, 580] }, cape_R: { parent: 'torso', pivot: [785, 590] },
  leg_L: { parent: 'torso', pivot: [545, 815] }, leg_R: { parent: 'torso', pivot: [718, 815] },
  arm_R_upper: { parent: 'torso', pivot: [765, 605] }, hand_R: { parent: 'arm_R_upper', pivot: [805, 662] },
  arm_L: { parent: 'torso', pivot: [496, 590] }, hand_L: { parent: 'arm_L', pivot: [352, 378] },
  head: { parent: 'torso', pivot: [632, 565] },
  ear_L: { parent: 'head', pivot: [480, 250] }, ear_R: { parent: 'head', pivot: [775, 250] },
  eye_L: { parent: 'head' }, eye_R: { parent: 'head' }, blush_L: { parent: 'head' }, blush_R: { parent: 'head' },
  nose: { parent: 'head' }, mouth: { parent: 'head' },
  fx_shadow: { parent: null }, fx_speedlines: { parent: null },
};

// Paths deliberately not used: 2 = the merged dark silhouette (shared out as per-part outlines).
export const dropped = [2];
