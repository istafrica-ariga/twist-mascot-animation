# twist-rig

Skeletal vector animation the way Rive does it — bones, vertex skinning, stroked shapes, solos, clipping, keyframes —
as our own TypeScript engine. No Rive dependency.

## Architecture (best practice for the Twist app)

```
RigModel (JSON) ──compileRig──▶ Rig (immutable topology)
                                 │
   per frame:  resetPose → applyAnimation(…, t, mix) → solve → displayList(view)   ← pure, 'worklet' functions
                                 │
                       DisplayList (paths · paints · clips, already in output space)
                          ┌──────┴───────┐
                  drawCanvas2D        drawSkia(Skia, canvas)
                (web, previews,      (React Native Skia — the app;
                 validation)          UI thread via Reanimated)
```

- **Core is renderer-agnostic and functional**: plain data in, plain data out, every per-frame function carries a
  `'worklet'` directive so evaluation can run on the React Native UI thread (Reanimated 4 / Worklets, both already
  in twist-mobile).
- **Renderers are thin**: the display list is already transformed to output space, so an adapter only maps paths and
  paints. The Skia adapter takes the `Skia` object as a parameter — `@shopify/react-native-skia` (2.6.2, already in the
  app) on device, its web build (JsiSkApi over CanvasKit) in tests — so tests exercise the same API calls.

## Validation
`node twist-rig/test/validate.mjs riv/study_screen_animation.riv <animation> [frames] [scale]` (after
`npx esbuild twist-rig/test/browser-entry.ts --bundle --format=iife --outfile=twist-rig/test/dist/bundle.js`) renders
official Rive vs our engine → Canvas 2D vs our engine → RN Skia, on the user's production rig:

| | Theme_Green, 6 frames @1.5× (% pixels differing from official) |
|---|---|
| Canvas 2D | 0.64 · 0.72 · 0.75 · 0.80 · 0.80 · 2.06 |
| React Native Skia | 0.64 · 0.73 · 0.77 · 0.81 · 0.82 · 2.03 |

Differences are anti-aliased edges; the ~2 % frame is the card's text (not implemented). Evaluating the whole
2,139-component scene + display list: ~1.1 ms/frame.

## Not yet
Text, state machines, IK/constraints, trim path, blend modes, images/meshes, the `<MascotCanvas>` React Native
component (Picture recorded in a `useDerivedValue` worklet driven by `useFrameCallback`).
