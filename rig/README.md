# The mascot as a twist-rig

Built the way the user's own Rive rig is built, but running on our engine (`../twist-rig`), no Rive dependency.

```
ref/ trace ──tools/fit.mjs──▶ rig/parts.json ──rig/mascot.ts──▶ rig/mascot.rig.json  (model + bones + state machine)
                               clean low-vertex curves          bones · skins · solos · animations · state machine
```

## Geometry (`tools/fit.mjs`)
- Each part → one **silhouette** (stroke under fill = outline) + **detail** shapes (highlights/shading) + **slits**
  (claw lines, creases: narrow notches found by a raster morphological closing, as small dark shapes).
- **Body + legs + right arm/paw = one silhouette** (like the user's rig, where body and limbs are one skinned path).
  The raised arm + fist is its own stroked shape on top, with a fill-only **shoulder patch** hiding its root seam,
  so it can cross in front of the body with its full outline.
- Curves: paper.js `simplify` (Schneider fitting), opened at the seam (closed-path simplify loses ~3 % area),
  tolerance scaled to shape size, area-checked. ~1,800 vertices total.
- Rest pose vs the original art: **1.33 %** pixels differ (`node rig/render.mjs`).

## Rig (`rig/mascot.ts`)
Bones: torso → head (+ ears, eye lids); 2-bone arms, legs and cape chains; fist/paw bones. Every path is skinned
(automatic distance-based weights, up to 2 bones per vertex, handles weighted separately). Mouth = Solo
(open / mid / closed). Stage fx (shadow, speed lines) live outside the character's root.

Animations: `stand` (arm down, mouth closed, breathing) · `launch` (crouch → stretch up, arm swings, mouth opens,
speed lines in, shadow shrinks) · `fly` (bob, cape flutter, dangling legs, fist pump, ears) · `blink`.
State machine `mascot`: layer **body** stand →(trigger `launch`)→ launch →(end)→ fly →(trigger `land`)→ stand;
layer **face** blink.

`node rig/anim.mjs` plays it like the app would → `check/mascot_anim.mp4`. Test poses: `node rig/render.mjs rig/poses/<pose>.json`.

## Known refinements
- Standing legs: the left leg keeps the art's tucked bend; needs a straightened leg pose (bones) or leg variant.
- Small slivers at the ear bases and above the left shoulder in the arm-down pose.
- Sound + haptics (as the badges have) not added yet.
