# Twist mascot — animation pipeline

The caped bat-pup mascot for the **Twist** learning app: illustrated, rigged, generated, measured.

Two routes were built end to end and compared on evidence rather than preference — a **vector rig**
in Rive, and **AI-generated video** through the same models Masko uses. Both work. They fail in
different places, and the numbers below say which to reach for.

---

## The deliverable

A 4-second splash launch — crouch, takeoff, cloud burst, ascent, overshoot, hover — with **no
background** and **synthesised sound**, running in a real iOS app.

| file | what it is | size |
|---|---|---|
| [`out/masko_redo/twist_launch_alpha.mov`](out/masko_redo/) | HEVC + **true alpha** + sound. iOS/macOS, no shader. | 650 KB |
| [`out/masko_redo/twist_launch_stacked_av1.mp4`](out/masko_redo/) | Masko's **stacked** format: colour on top, alpha matte below. Any platform, needs a 2-line shader. | 356 KB |
| [`out/masko_redo/twist_launch_preview.mp4`](out/masko_redo/) | Watchable preview on the brand gradient, with sound. | 431 KB |
| [`out/masko_redo/twist_launch_alpha.webp`](out/masko_redo/) | True alpha, drops in anywhere, but **7.9 MB** — see why below. | 7.9 MB |
| [`ios-demo/`](ios-demo/) | Xcode project that plays it transparently. Builds clean, no signing. | — |

```bash
open ios-demo/TwistSplashDemo.xcodeproj     # pick any iPhone simulator, ⌘R
```

Verified on an iPhone 17 Pro simulator: transparent over the app's own gradient, no black box,
no green fringe.

---

## How it was made

1. **Identity → pose.** The two reference stills plus a character brief go to Gemini 3 Pro Image
   through OpenRouter, asking for the standing pose **on flat chroma green**. ~$0.14.
   Green because no colour in the character is near it — white would punch holes in the eye
   highlights and the fangs.
2. **Pose → clip.** That still, padded to 1080×1920 on the same green, animated with
   **MiniMax H3 Max Turbo** — the model Masko's Standard tier runs on — at 768p, 9:16, 5 s.
   250 credits. The prompt is the beat sheet in [`out/launch/SPEC.md`](out/launch/SPEC.md).
3. **Clip → alpha.** `colorkey` + `despill`, retimed 5.17 s → 4.04 s.
4. **Sound.** [`tools/launch_sfx.py`](tools/launch_sfx.py) synthesises the whole cue sheet from
   noise and sine partials — stdlib only, no samples, no licence. Cues land on the animation's own
   beats: crouch 0.55 s, takeoff 0.68 s, puffs 0.80 s, settle 1.50 s, wordmark 1.85 s,
   sparkle 2.30 s.

Everything is scripted. `tools/` holds the generator, the keying, the comparison sheets and the
sound.

---

## What was measured

### Identity holds

Sending both reference images with every call reproduces what Masko sells as "character
consistency" — there is no stored model behind it. A pose the references never contained
(celebrating, both paws up) kept the ears, fangs, tongue, cape and medallion.
**$0.1401, 34.6 s, 1,302 prompt + 1,381 completion tokens.**

### The video is soft, and the generation is the bigger half

The mascot is only **397 × 366 px** inside the 768×1344 frame — 6.8 % of the pixels. On an iPhone
17 Pro that is drawn at **623 physical px**, a 1.57× upscale. The reference artwork is 2000 px for
the same character, roughly **four times the detail**.

The encode costs real quality too, more than first assumed:

| encode | SSIM vs the raw generation | size |
|---|---|---|
| `hevc_videotoolbox` q:v 50 | 0.901 | 584 KB |
| q:v 65 | **0.917** | 1,143 KB |
| q:v 80 | 0.917 | 2,021 KB |

Quality **plateaus at 0.917** — the rest is 4:2:0 chroma subsampling, which no bitrate fixes. It
hits red hardest (R 0.825 vs G 0.937): the cape bleeding into the purple.

### Vectorising it does not help

Tracing the frames (the Anim8 approach) buys harder edges but **lumpy outlines**, and costs:

| | |
|---|---|
| one traced frame, gzipped | 169 KB |
| all 98 frames | **≈ 16.2 MB** |
| the whole video | **584 KB** |

**28× larger, for worse shapes.** Tracing a soft raster cannot recover detail that was never
generated. Measured twice — once on the Seedance reference (2,235 paths, 3.09 MB, 65×) and again
here on flat art over transparency, which is tracing's best case.

### Why there is no single light file with true alpha

**WebP always stores its alpha channel losslessly**, whatever quality you ask for — re-encoding at
quality 58 and 16 fps moved the file by one kilobyte (7,946 → 7,945 KB). Video codecs compress far
better but the common ones carry no alpha, which is exactly why Masko ships stacked video and
rebuilds the alpha in its player.

**HEVC-with-alpha is the exception** and solves iOS: 650 KB, no shader, verified against ground
truth at 6.8 % opaque / 93.0 % clear. Android has no equivalent and takes the stacked file.

### The timing limit that does not go away

The spec calls for takeoff at **0.25–0.55 s**. The Seedance reference put it at **~1.25 s**, 0.9 s
late, travelling 23 pp against the rig's 67.5 pp. Generated video cannot be retimed, so a written
beat sheet is the one thing it cannot satisfy.

---

## The other route: the Rive rig

`~/Documents/twist-splash` — the mascot's real vector art as a `.riv` with a skinned bone rig,
built with the Rive CLI from [`tools/rml.mjs`](tools/rml.mjs). **160 KB**, sharp at any density,
retimeable, themeable.

| Step | State |
|---|---|
| 1. Split the original into named rig parts, nothing added | done — `out/mascot_parts.svg` |
| 2. Hidden geometry + outline completion | done — rest pose 0.011 % from the trace |
| 3. New art (stand arms, closed mouth, blink, cape shapes) | partial — `out/mascot_variants.svg` |
| 4. Bones, skinning, cape | done — 8 bones, 9 skinned parts |
| 5. Arms/legs bending, state machine, effects | **not done** |

Rest-pose fidelity: 0.019 % of pixels differ from the trace, 0.111 % from the original PNG — the
same as the trace's own difference. The differing pixels are anti-aliased edges only.

Three hard-won `.rml` facts, in case they save someone the afternoon:

- **Draw order is the reverse of SVG.** The first drawable declared paints *last*. A backdrop
  declared first hides the whole scene — everything renders perfectly, invisibly, behind it.
- **A Tendon carries its bone's FORWARD bind transform, not the inverse.** Passing the inverse
  shreds the mesh into spikes.
- **Don't double-increment on `Z` when parsing SVG paths.** The command token is already consumed;
  incrementing again swallows the following `M` and every subpath after the first vanishes.
  Symptom: parts render as solid dark blobs.

---

## Honest comparison

| | generated video | Rive rig |
|---|---|---|
| effort | one prompt, 250 credits | days of rigging |
| size | 356–650 KB | **160 KB** |
| sharpness | soft, 397 px of source detail | **exact at any density** |
| retiming | impossible | free |
| theming | impossible | an input |
| interruptible | no | yes |
| cape, puffs, follow-through | free | hand-authored |

**Video is right for a splash** — it plays once, nothing drives it, and it was cheap. **The rig is
right for anything the app controls**, and it is the answer to the sharpness problem, because the
artwork is already vector and the rig never resamples it.

---

## Cost, for the record

- **OpenRouter:** 2 image calls, **$0.28** total.
- **Artlist credits:** 500 of an 80,000/month plan — one wasted 250 on a misread of the brief.
- **Masko:** 8 credits, before the measurements above; balance now 0.
- Sound effects were **synthesised**, not licensed: the account's plan does not include the SFX
  library, and for flat vector UI a built cue sheet lands on the beats more precisely anyway.

---

## Layout

- `tools/` — every script: SVG → `.rml`, the green start frame, keying, comparison sheets, sound.
- `out/masko_redo/` — the shipped clip, all formats, with [its own notes](out/masko_redo/README.md).
- `out/launch/SPEC.md` — the written brief that is the authority for the animation.
- `ios-demo/` — the Xcode project, with [integration notes](ios-demo/README.md).
- `MASKO.md` — how Masko actually works, reverse-engineered: the four layers, the engine, the
  models, the economics, and what of it is reproducible.
- `ref/`, `rig/`, `rig2/`, `rig3/`, `poses/`, `twist-rig/` — the vector rig work.
- `riv/` — Rive file analysis and the headless render harness.
