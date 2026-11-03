# Twist launch — sound and haptics

Authored in the house sound engine from `badges/_kit`, not invented separately. The synth helpers
(`marimba`, `bell`, `pluck`, `voice`, `env`, `osc`, the convolution room and the compressor) are
copied verbatim from `badges/insight/insight-badge.html`, so this sits in the same family as the
badge sounds and the study-path kit in `~/Documents/study-sounds`.

The kit's rule, from `_kit/GUIDE.md`:

> Sounds: Duolingo-style — woody marimba, bells, plucks, rising major notes; no harsh noise. Every
> key beat has a sound and (for important ones) a haptic. Keep beats ≥ 80 ms apart.

**One cue sheet drives both the audio and the haptics**, so they cannot drift apart. It lives in
[`../../../tools/launch_sound.html`](../../../tools/launch_sound.html); render with
`node tools/render_launch_sound.mjs`.

## The cue sheet

| time | sound | what it is | haptics |
|---|---|---|---|
| 0.55 s | `crouch` | low woody double, falling — loading the spring | transient 0.28 / 0.30 |
| 0.68 s | `launch` | thrust drop under a rising C5–E5–G5–C6 pluck arpeggio, marimba landing on top | continuous 0.22 s ramping 0.25→1, then transient 0.95 / 0.75 |
| 0.80 s | `puff` | soft low marimba tap, panned left | transient 0.18 / 0.20 |
| 0.90 s | `puff` | the second puff, higher, panned right | transient 0.14 / 0.20 |
| 1.50 s | `settle` | the kit's own woody arrival, C6 then G5 | transient 0.30 / 0.35 |
| 1.85 s | `tada` | reward chord: kick, C–E–G triad spread, bells on top | transient 0.70 / 0.80 + continuous 0.34 s fading |
| 2.30 s | `sparkle` | two high bells, wide | two transients 0.20 and 0.15 / 1.00 |

The launch is three layers because one is never heroic enough: a low thrust that drops away
underneath, the rising major arpeggio that carries the lift, and a marimba on the top note so it
*arrives* rather than trailing off.

The cloud puffs are **marimba taps, not air noise**. Noise there fights the arpeggio and breaks
the kit's no-harsh-noise rule.

## Files

| file | what it is |
|---|---|
| `twist_launch.wav` | **48 kHz / 24-bit mono** — the house format, matching `study-sounds/`. This is what the AHAP references and what a Rive `<AudioAsset>` would embed. |
| `launch_stereo.wav` | 48 kHz / 16-bit stereo, as rendered — used for the video mux |
| `twist_launch.ahap` | iOS Core Haptics: `AudioCustom` + 10 haptic events, same convention as the badge AHAPs |
| `twist_launch.android.json` | Android `VibrationEffect.createWaveform` timings and amplitudes |
| `twist_launch.web.json` | Web Vibration API pattern (no intensity, so taps become length) |

## Measured

Peak per cue, against the house kit for reference:

| cue | peak | |
|---|---|---|
| `tada` | 0.533 | the reward, top of the hierarchy |
| `launch` | 0.524 | the hero moment, level with it |
| `crouch` | 0.316 | anticipation, beneath |
| `settle` | 0.292 | arrival, beneath |
| `sparkle` | 0.135 | texture tier |

Overall RMS **0.062** — inside the house band (the study-path kit runs 0.046–0.146). Peak 0.57,
against the kit's loudest at 0.89, so there is headroom to sit under a video mix.

⚠ **Never `-c:v copy` the HEVC-alpha movie to add audio** — the alpha layer is a second parameter
set and copying corrupts it (`PPS id out of range`, frames decode opaque). Encode video and audio
in one pass; verified afterwards at 6.8 % opaque / 93.0 % clear.
