# Twist skeletal-vector engine

Rive's approach — bones, vertex skinning, stroked vector shapes, solos, clipping, keyframe animation — with **no
Rive dependency**. `engine.mjs` is ~350 lines of plain JS; the maths was taken from rive-runtime's open-source C++
(see `../riv/FINDINGS.md` for what each piece does and where it came from).

## Proof it works
`node engine/validate.mjs riv/study_screen_animation.riv <animation> [frames] [scale]` renders the same frames with
this engine and with the official Rive runtime and diffs them. On the user's production rig (skateboarding mascot,
53,694 objects, 41 skins):

| Animation | Mismatch per frame (% pixels) |
|---|---|
| Theme_Green / Purple / Blue / Brown, 10 frames each @1.5× | 0.5–0.8 % (anti-aliased edges only); ~2 % once the card's text appears (text not implemented) |
| Theme_Green frame 0 @4× | 0.021 % |

## What it implements
- Transform hierarchy (x, y, rotation, scale, opacity); bones (child bone at x = parent length)
- Skinning: per-tendon `boneWorld · inverse(bind)`, 4 weighted bones per vertex, separate handle weights
- Paths: straight / cubic detached / mirrored / asymmetric vertices, natural-rounding corner radius
- Paints: fill + stroke (width scales with the shape), solid colour, linear / radial gradients
- Draw order (reverse hierarchy), Solo (one visible child), clipping by a shape or a whole node, hidden flag
- Animation: keyed properties, hold / linear / cubic-bezier / elastic keyframes, colour lerp

## Not yet
Text, state machines (transitions + blending), IK / other constraints (the maths is noted in FINDINGS), trim path,
blend modes, images/meshes. The state machine is next on the list — the mascot needs stand → launch → fly → hover.

## Files
- `engine.mjs` — the engine (`Scene`: `reset()`, `applyAnimation(anim, t)`, `update()`, `draw(ctx, view)`)
- `from-riv.mjs` — test-only adapter: decoded .riv → engine model (to validate against real Rive rigs)
- `validate.mjs` — ours vs official, side by side + diff → `check/engine_<animation>.png`
