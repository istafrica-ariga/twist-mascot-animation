# Measured target spec

Four attempts at this sound were rejected. Rather than guess a fifth time, two Duolingo clips were
measured and ours measured against them on identical metrics, with `tools/sound_spec.py`.

The reference clips were downloaded only to measure. Nothing from them is copied, sampled or
shipped — what they produce here is a set of numbers to aim at.

## The comparison

| | correct | lesson complete | **ours (hero theme)** |
|---|---|---|---|
| RMS | 0.030 | 0.044 | **0.110** |
| peak | 0.413 | 0.390 | **0.736** |
| crest factor | 22.8 dB | 18.9 dB | **16.5 dB** |
| **energy below 300 Hz** | **2.1 %** | **0.1 %** | **25.9 %** |
| mid 300 Hz – 3 kHz | 74.1 % | 86.6 % | 58.0 % |
| above 3 kHz | 23.8 % | 13.3 % | 16.1 % |
| spectral centroid | 1961 Hz | 1882 Hz | **1412 Hz** |
| decay to −20 dB | 120 ms | 120 ms | **370 ms** |
| dead air | 66.7 % | 49.8 % | **21.4 %** |
| register | octaves 5–6 | octaves 5–6 | octaves **2**–6 |

## What this says

**There is essentially no bass in Duolingo's sounds.** 0.1–2.1 % of their energy sits below 300 Hz.
Ours is 25.9 %. That single number is the whole problem: the hero theme has a C2 bassline and a
kick dropping to 42 Hz, and the target has neither. It is the difference between a film-trailer
sting and a music box, and I built the wrong one.

The rest follows from it:

- **Too loud.** Theirs sits at RMS 0.030–0.044. Ours is 0.110, roughly three times.
- **Too squashed.** Crest 16.5 dB against their 18.9–22.8. Theirs are transient and plucky; the bus
  compressor flattened ours.
- **Too dark.** Centroid 1412 Hz against ~1900. Theirs live up where a xylophone lives.
- **Rings too long.** 370 ms to −20 dB against their 120 ms. Theirs are dry and get out of the way.
- **Too full.** They leave 50–67 % of the clip near silence. I treated space as a fault and filled
  it; space is the aesthetic.

Worth noting: the *first* attempt was closer on density and register than the "fill it with music"
rebuild that followed. It failed for being mono, dry and untuned — not for being sparse.

The pitch track also confirms the published analysis: the correct-answer sound measures
**F♯6 → A♯6**, a rising major third, high up.

## The spec to build to

| | target |
|---|---|
| energy below 300 Hz | **under 5 %** — no kick, no sub, no bassline |
| register | **C5–C7**, nothing below about C4 |
| spectral centroid | **1800–2000 Hz** |
| decay to −20 dB | **120–180 ms** — short and dry |
| RMS | **0.035–0.050** |
| peak | **0.40–0.50** |
| crest factor | **19–23 dB** — leave the transients alone, little or no bus compression |
| dead air | **40–60 %** — silence is part of it |
| reverb | light and short; the references are nearly dry |

Regenerate the comparison at any time with:

```bash
python3 -I tools/sound_spec.py <reference.wav> out/masko_redo/audio/<ours>.wav
```
