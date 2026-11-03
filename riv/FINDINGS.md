# What `study_screen_animation.riv` teaches (decoded 2026-10-21)

Tools (all in `riv/`): `decode.mjs` (schema pulled from rive-runtime's generated headers), `analyze.mjs` (hierarchy,
skins, animations, state machines → `study_report.txt`), `encode.mjs` (writes .riv; round trip of this file is
object-identical and renders pixel-identical in the official runtime), `render.mjs` / `zoom.mjs` (official
`@rive-app/canvas` runtime in headless Chromium → contact sheets).

## The file
Rive 7.4 · one artboard 393×461 · 53,694 objects · 22 animations · 3 state machines (inputs: `Button click`,
`Button_Long_Text`, `Inverted`, `Theme`) · a ViewModel for data binding · no images (all vector; one font).
It's the same bat-pup mascot, in a helmet, skateboarding down a lesson path; themes recolour everything.

## How the character is built
- **Clean, low-vertex shapes.** 108 shapes, 144 paths, ~1,000 vertices in total. A limb or claw path is 6–7 cubic
  vertices. Not traced geometry.
- **Outlines are Strokes** on the shapes (thickness 20 / 40 before node scale), colour `#320e64`; fills `#d886f6`,
  `#b457e8` — the same palette as our mascot.
- **Limbs = one closed path skinned to a 2-bone chain** (RootBone + Bone). 4 limb chains + a 2-bone body chain.
  41 Skins, 185 Tendons, 266 CubicWeights: vertices (and their bezier handles) carry per-bone weights; claws are
  100 % bound to the hand bone. Arms going short ↔ long = bone **length/rotation/scale keyed** (`RootBone.length`
  is keyed in `Theme_Green`), not swapped drawings.
- **Solos** for swaps: `Ligtning` keys a Solo's `activeComponentId` 13 times over 3.5 s (frame-by-frame flicker).
- **Clipping shapes** (5) for masks; gradients (linear 17, radial 3).
- **Animations key**: bone rotation/length/scale/position, shape transforms, vertex positions + handles (path
  morphs — 214 vertices in `Theme_Green`), colours (theming). Interpolators: cubic ease, elastic.
- **State machines** pick animations from inputs; listeners fire an event (`start_lesson_clicked`).

## What that means for our mascot
The sustainable pipeline is Rive-native: clean low-vertex shapes with fill + stroke, limbs skinned to bone chains,
solos for mouths/eyes, animations as keyframes on bones, a state machine for stand → launch → fly → hover — authored
as a spec in code and **written straight to .riv** by `encode.mjs`, verified by rendering with the official runtime.
The traced/layered SVG work (`out/`) becomes the reference the clean shapes are fitted to, not the deliverable.
