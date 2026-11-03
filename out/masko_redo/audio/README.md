# Twist launch — hero theme and haptics

**A four-second superhero sting**, composed rather than assembled: 154 BPM, I–IV–V–I in C,
resolving on the wordmark. Score in [`../../../tools/hero_theme.html`](../../../tools/hero_theme.html),
rendered with `node tools/render_hero_theme.mjs`.

## Why this is a restart, not a revision

Three earlier passes were rejected, and each one failed the same way. The first was mono, dry and
untuned. The second was pitched and in key but still thin. The third was built on a rising major
third, the interval Duolingo's correct-answer sound uses, which was the right research and still
the wrong answer.

They all shared one wrong premise: **they were sound effects** — six short taps triggered at
animation beats, with silence between them. Retuning cannot fix that, which is why three attempts
to retune it did not.

A splash does not want effects. It wants a **sting**: a small piece of music with a bassline,
chords that move, and a tune, which happens to land its accents where the mascot moves. Netflix's
two notes, the PlayStation chime, Duolingo's own Learning Path music — all composed phrases, none
of them a pile of taps.

Measured difference: the previous version had long gaps and an RMS of 0.069. This one has
**0.0 % dead air** between 0.45 s and 3.0 s and an RMS of **0.110**, still inside the house band
(the study-path kit runs 0.046–0.146).

## The arrangement

| time | chord | what happens |
|---|---|---|
| 0.45 s | — | pickup: three notes winding up under the crouch |
| **0.68 s** | **C (I)** | **takeoff** — kick, bass, chord stab, melody hits the tonic |
| 0.88–0.98 s | | the hook climbs E5 → G5 with him |
| **1.07 s** | **F (IV)** | the climb; melody peaks on C6 |
| **1.46 s** | **G (V)** | the hang; melody eases down F5 → E5 |
| **1.85 s** | **C (I)** | **the wordmark — everything arrives home together** |
| 2.30 s | | two bright flecks as the sparkles land, then the room carries it out |

Verified by pitch-detecting the bass in the render rather than trusting the score:
**C2 → F2 → G2 → C2**.

## The engine

Subtractive, written for this: oscillators → resonant low-pass **with its own envelope** → amp
envelope. That filter sweep is what makes a note sound played rather than generated, and it is
what the earlier additive sine stacks could not do.

| voice | what it is |
|---|---|
| `bass` | saw + square an octave down, low cutoff — weight |
| `stab` | two squares 12 cents apart + a saw, spread hard left/centre/right — the chords |
| `lead` | square + triangle, bright cutoff, glides into its first note — the tune |
| `shine` | triangle + high sine, long release — the ring-out over the wordmark |
| `kick`, `tick` | pitch-dropping sine; filtered noise — rhythm, so four seconds is not a slideshow |
| `wood` | the badge kit's marimba partials (1, 4, 9.9), kept as a thread back to the house sound |

Bus compressor and a high shelf at 3.2 kHz; a short, tight plate so it feels close rather than
distant.

## Haptics

Cut to the **music**, not the picture — the body should feel the downbeats, because that is what
the ear is already following. Ten events: taps on the pickup, a ramped continuous plus a hard
transient on the takeoff, one on each chord change, the biggest on the resolution at 1.85 s.

## Files

| file | what it is |
|---|---|
| `twist_launch.wav` | **48 kHz / 24-bit mono** — the house format, matching `~/Documents/study-sounds` |
| `hero_theme.wav` | 48 kHz / 16-bit stereo as rendered, used for the video mux |
| `twist_launch.ahap` | iOS Core Haptics: `AudioCustom` + 10 events, same convention as the badge AHAPs |
| `twist_launch.android.json` | Android `VibrationEffect.createWaveform` timings and amplitudes |

Peak 0.737, RMS 0.110, stereo correlation 0.956, channel balance +0.14 dB.

⚠ **Never `-c:v copy` the HEVC-alpha movie to add audio** — the alpha layer is a second parameter
set and copying corrupts it (`PPS id out of range`, frames decode opaque). Encode video and audio
in one pass; verified afterwards at 6.8 % opaque.
