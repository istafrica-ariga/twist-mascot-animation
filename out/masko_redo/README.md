# Twist mascot launch — generated the Masko way, delivered with no background

A new animation, not an edit of the reference video. Built 2026-10-30.

## How it was made

1. **Identity → pose.** The two reference stills were sent to Gemini 3 Pro Image through OpenRouter
   with the character brief, asking for the standing pose **on a flat chroma-green background**.
   $0.14. Green is used because no colour in the character is anywhere near it, so it keys out
   cleanly — white would have punched holes in the eye highlights and the fangs.
2. **Pose → clip.** That still was padded to 1080×1920 on the same green (the seam is invisible,
   so the mascot sits low with room to launch) and animated with **MiniMax H3 Max Turbo** —
   the same model Masko's Standard tier runs on — at 768p, 9:16, 5 s. 250 credits.
   The prompt is the beat sheet from `../launch/SPEC.md`: anticipation crouch, takeoff, cloud
   puffs, ascent, deceleration, overshoot, settle, hover, with the camera-lock and cape rules.
3. **Clip → alpha.** `colorkey` + `despill` in ffmpeg, retimed 5.17 s → 4.04 s to match the
   reference's pace.

## Files

| file | what it is | size |
|---|---|---|
| `twist_launch_stacked_av1.mp4` | **Masko's own format** — colour on top, alpha matte below, 768×2688 | 316 KB |
| `twist_launch_stacked.webm` | same stacking, VP9 instead of AV1 | 440 KB |
| `twist_launch_alpha.webp` | animated WebP, **true per-pixel alpha**, drops straight into an app | 7.9 MB |
| `twist_launch_on_checker.mp4` | preview only — the keyed clip over a checkerboard | 474 KB |
| `g_raw.mp4` | the untouched generation, still on green | 3.2 MB |

## Why there is no single light file with real alpha

This is the same wall Masko hit. **WebP always stores its alpha channel losslessly**, whatever the
quality setting — re-encoding at quality 58 and 16 fps changed the file by one kilobyte
(7,946 → 7,945 KB), which is the proof. Video codecs compress far better but the common ones carry
no alpha channel at all — which is exactly why Masko ships **stacked** video and reconstructs the
alpha in its player. The 316 KB stacked AV1 is the light answer; it needs two lines of shader
(sample the top half for colour, the bottom half for alpha) wherever it is drawn.

The one remaining lever on the WebP is **area**: the mascot uses a small part of a 768×1344 frame,
so cropping to the motion's bounding box and dropping to 12 fps would cut it several times over.
Not done here because it needs an offset recorded alongside it for the app to position it.

This build's ffmpeg cannot write VP9-with-alpha WebM (`libvpx-vp9` accepts `yuva420p` but the
muxer drops the alpha layer — verified by decoding a frame back and finding the corner opaque).
A build with working VP9 alpha would land near 600 KB with real alpha and no shader.

## Known issues

- The hover drifts slightly down and to the right in the last second instead of holding centre.
- Travel is about 40 % of frame height against the reference's 65 %.
- Timing is the generator's, not the spec's — the spec's 0.25–0.55 s takeoff is still not hit.
  That limit is unchanged and is why the Rive rig exists.

## HEVC with alpha — the format that solves iOS

Added after the first pass. `hevc_videotoolbox` on this Mac accepts `bgra` and exposes
`-alpha_quality`, so a true-alpha HEVC `.mov` is possible without any shader:

- **`twist_launch_alpha.mov` — 584 KB, true per-pixel alpha, plays natively in AVPlayer.**
- Verified against ground truth rather than trusted: the decoded frame is **6.8 % opaque /
  93.0 % clear, mean alpha 17.5**, against the keyed source's 6.8 % / 93.0 % / 17.6. Identical.
- (A single-pixel probe misleads here — the mascot covers only 6.8 % of the frame, so a blind
  sample almost always lands on background. Coverage statistics are the right check.)

Android has no HEVC-alpha support, so Android takes the stacked AV1 plus a two-line shader, or a
VP9-alpha WebM built on a machine whose ffmpeg can write one.

## Why it looks soft on the phone — measured

Asked after seeing it on the simulator. Two causes, and I had the weighting wrong at first.

**1. The generation, which is the bigger half.** The mascot is only **397 × 366 px** inside the
768×1344 frame — it uses 6.8 % of the pixels. On an iPhone 17 Pro that 397 px is drawn at **623
physical px**, a 1.57× upscale of an already-small region. Your reference artwork is 2000 px wide
for the same character, so roughly **four times the detail**. On top of that, diffusion video
models cannot hold a constant-width vector outline — compare the fur edges against the reference
and the generated outline visibly breathes.

**2. My encode, which costs more than I assumed.** Measured against the raw generation at the same
frame:

| encode | SSIM vs generation | size |
|---|---|---|
| `hevc_videotoolbox` q:v 50 (shipped first) | 0.901 | 584 KB |
| q:v 65 | **0.917** | 1,143 KB |
| q:v 80 | 0.917 | 2,021 KB |

**Quality plateaus at 0.917.** Going from q:v 65 to 80 buys nothing and doubles the file — the
remaining loss is **4:2:0 chroma subsampling**, which no bitrate fixes. It hits red hardest: the
red channel scores SSIM **0.825** against green's 0.937, which is the cape bleeding into the
purple behind it.

`twist_launch_alpha_hq.mov` is the q:v 65 version if the extra 560 KB is worth 0.016 SSIM to you.
For a splash screen it probably is not.

### What would actually fix it

1. **The Rive rig.** Vector, so it is exactly as sharp as the screen allows at any density, and it
   is **160 KB** — smaller than every video here. This is the real answer and it already exists.
2. **Regenerate at 1080p with the mascot filling more of the frame.** 500 credits. Would take the
   character from 397 px to roughly 800 px and cut the upscale to about 1.1×. Sharper, but still
   carrying the generator's soft outlines.
3. Re-encoding alone cannot get past 0.917, so it is not a fix.

## Passing it through Anim8 — tested 2026-10-30

**The real Anim8 is gated.** The account signs in but the projects page says *"Subscribe for $9/mo
to open the editor"* — vectorization is Pro. So this is their *technique* reproduced locally with
VectorCraft's tracer, not their own Web Worker. The per-frame economics are identical either way,
and their defaults (path budget 128, 30 fps) are **denser** than what I ran.

Traced the hover frame, flat-art settings (color mode, limited palette, 14 colours, paths 85,
corners 80, overlapping): **86 paths, 11,732 anchors, 14 colours**.

### Does it look better?

**Sharper edges, worse shapes.** Side by side at the exact size the phone draws (623 px), the
traced version has genuinely harder outlines — no soft halo. But the outlines have gone **lumpy**:
the cape edge and the head silhouette bulge where they should be smooth curves, the ear tips
blob out, and the body's subtle shading flattens. It reads as *autotraced*, because it is.

Tried `mode: "logo"` first, which is built for flat art — it traced at half resolution and dropped
to **5 colours**, losing the gold medallion entirely and the white eye highlights with it. The
colour-mode settings above are the fair comparison.

### The cost

| | |
|---|---|
| one traced frame, raw SVG | 466 KB |
| one traced frame, gzipped | 169 KB |
| **all 98 frames, gzipped** | **≈ 16.2 MB** |
| the whole 4 s video, for comparison | **584 KB** |

**28× larger than the video it came from**, for lumpier shapes.

### Verdict

Not worth the $9. And it cannot fix the real problem: the mascot is only 397 px in the source, so
tracing it gives crisp-but-wrong shapes rather than recovering detail that was never generated.
Vectorising a soft raster does not reconstruct the artwork — it just hardens the mush.

This is the second time this has been measured (the first was the Seedance hover loop: 2,235 paths,
3.09 MB, 65× the source). Flat art on transparent is tracing's best case and it still loses.

**The artwork is already vector.** `~/Documents/twist-splash/build/twist-splash.riv` is 160 KB with
the real curves. That is the sharp, light answer and it does not involve tracing anything.
