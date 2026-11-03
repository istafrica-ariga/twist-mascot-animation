#!/usr/bin/env python3
"""Synthesise the splash soundtrack as a tuned instrument, not a pile of sound effects.

The first version of this was mono, dry, and built from raw noise and bare sine tones, and it
sounded cheap. Apps whose audio people actually like (Duolingo being the obvious one) do four
things this now does:

  1. Everything is PITCHED and in one key. No untuned noise carrying a cue.
  2. Notes are harmonic STACKS, each partial decaying at its own rate — that is the difference
     between a sine beep and something that reads as an instrument.
  3. A short PITCH ENVELOPE on each attack: the note starts sharp and falls into tune over a few
     milliseconds. That is the plucky "plop" quality, and its absence is why beeps sound dead.
  4. STEREO and a small ROOM. Dry mono is the single loudest tell of a hobby sound.

Key is D major throughout, so the whoosh, the settle and the wordmark chord are all consonant
with each other and read as one instrument rather than unrelated noises.

Stdlib only — no numpy on this machine — so it is written for clarity over speed. ~10 s to render.
"""
import math
import random
import struct
import sys
import wave

SR = 44100
DUR = 4.10
N = int(SR * DUR)

L = [0.0] * N
R = [0.0] * N
rng = random.Random(7)          # fixed seed: the file regenerates byte-identical

# D major. Keeping every cue inside one scale is what makes them sound related.
D3, A3 = 146.83, 220.00
D4, FS4, A4, D5 = 293.66, 369.99, 440.00, 587.33
D6, FS6 = 1174.66, 1479.98

# A marimba-ish partial set: harmonic-ish but with the upper partials pushed slightly sharp and
# decaying fast, which is what stops it sounding like an organ.
PARTIALS = [
    # (ratio, amplitude, decay multiplier)
    (1.00, 1.00, 1.00),
    (2.00, 0.38, 0.62),
    (3.01, 0.17, 0.42),
    (4.18, 0.09, 0.28),
    (5.43, 0.05, 0.20),
    (6.81, 0.03, 0.14),
]


def at(t):
    return int(t * SR)


def note(freq, dur, bend=0.07, bright=1.0, curve=2.6):
    """One struck note: harmonic stack, per-partial decay, and a pitch envelope on the attack.

    `bend` is how sharp the attack starts, as a fraction of the fundamental; it decays away over
    the first ~25 ms. This is the single most important ingredient — without it the note reads as
    a test tone.
    """
    n = int(dur * SR)
    out = [0.0] * n
    attack = max(1, int(SR * 0.004))
    bend_len = max(1, int(SR * 0.025))

    for ratio, amp, dmul in PARTIALS:
        # `bright` rolls the upper partials off: < 1 is mellow and woody, nearer 1 is glassy.
        a = amp * (bright ** (ratio - 1.0))
        if a < 0.002:
            continue
        phase = 0.0
        decay = max(1, int(n * dmul))
        for i in range(n):
            # pitch envelope: starts `bend` sharp, settles into tune
            b = bend * math.exp(-3.0 * i / bend_len) if i < bend_len else 0.0
            phase += 2 * math.pi * freq * ratio * (1.0 + b) / SR
            if i < attack:
                e = i / attack
            elif i - attack < decay:
                e = (1.0 - (i - attack) / decay) ** curve
            else:
                e = 0.0
            if e:
                out[i] += math.sin(phase) * a * e
    return out


def swoop(dur, f0, f1, bright=0.55):
    """A pitched rise — the takeoff. Same instrument as the notes, but the fundamental sweeps.

    Pitched, not noise: a noise whoosh belongs in a film trailer, not on a 4-second app splash
    where it has to sit next to a musical sting a second later.
    """
    n = int(dur * SR)
    out = [0.0] * n
    for ratio, amp, dmul in PARTIALS[:4]:
        a = amp * (bright ** (ratio - 1.0))
        phase = 0.0
        for i in range(n):
            p = i / n
            f = f0 * (f1 / f0) ** (p ** 0.72)       # exponential: reads as acceleration
            phase += 2 * math.pi * f * ratio / SR
            # swell in, then taper — the body arrives before the peak of the pitch
            e = math.sin(math.pi * p) ** 1.3
            out[i] += math.sin(phase) * a * e
    return out


def air(dur, cutoff=0.045, curve=2.4):
    """Soft rounded air for the cloud puffs — low-passed noise with no transient bite.

    This is the one place noise belongs: the puffs are air, and air has no pitch.
    """
    n = int(dur * SR)
    out = [0.0] * n
    lp = 0.0
    attack = int(n * 0.12)
    for i in range(n):
        lp += cutoff * (rng.uniform(-1, 1) - lp)
        e = (i / attack) if i < attack else (1.0 - (i - attack) / (n - attack)) ** curve
        out[i] = lp * e
    return out


def place(samples, start, gain=1.0, pan=0.0):
    """Mix into the stereo bus. `pan` is -1 left … +1 right, equal-power."""
    lg = gain * math.cos((pan + 1) * math.pi / 4)
    rg = gain * math.sin((pan + 1) * math.pi / 4)
    for k, v in enumerate(samples):
        i = start + k
        if 0 <= i < N:
            L[i] += v * lg
            R[i] += v * rg


# --- the cue sheet, on the animation's own beats -------------------------------------

# 0.55 s — anticipation. A low note falling as the knees bend.
place(swoop(0.20, A3, D3 * 0.75, bright=0.35), at(0.55), 0.22, -0.12)

# 0.68 s — takeoff. Two octaves up, in key, doubled an octave apart for body.
place(swoop(0.38, D3, D5 * 1.5), at(0.68), 0.50, 0.0)
place(swoop(0.34, D4, D5 * 2.0, bright=0.30), at(0.70), 0.18, 0.10)

# 0.80 s — the cloud puffs. Two of them, panned hard apart so they read as separate shapes.
# Kept well under the takeoff: they are a texture beneath it, not an event of their own. At 0.26
# they measured level with the wordmark sting, which made the middle of the clip a wall.
place(air(0.30), at(0.80), 0.15, -0.70)
place(air(0.24, cutoff=0.060), at(0.87), 0.11, 0.66)

# 1.50 s — settle. A warm low note giving the body weight. Deliberately quiet.
place(note(D3, 0.55, bend=0.04, bright=0.40), at(1.50), 0.10, 0.0)

# 1.85 s — the wordmark. A rising D-major arpeggio, staggered into a sparkle and spread
# left-to-right so it opens up as it climbs.
for k, (f, delay, pan) in enumerate([(D4, 0.000, -0.52), (FS4, 0.055, -0.18),
                                     (A4, 0.110, 0.18), (D5, 0.165, 0.52)]):
    place(note(f, 1.45 - 0.12 * k, bright=0.72), at(1.85 + delay), 0.30, pan)

# 2.30 s — reward accent. Two high taps, quiet, wide.
place(note(D6, 0.60, bend=0.10, bright=0.55), at(2.30), 0.085, -0.55)
place(note(FS6, 0.50, bend=0.10, bright=0.50), at(2.46), 0.065, 0.55)


# --- room ----------------------------------------------------------------------------

def reverb(ch, delays, wet=0.17):
    """Schroeder reverb: parallel combs into series allpasses. Small room, low wet — enough to
    stop it sounding like it was recorded inside a phone, not enough to smear the attacks."""
    out = [0.0] * N
    for d, fb in delays:
        buf = [0.0] * d
        idx = 0
        for i in range(N):
            v = buf[idx]
            out[i] += v
            buf[idx] = ch[i] + v * fb
            idx = (idx + 1) % d
    out = [v / len(delays) for v in out]

    for d, g in ((int(SR * 0.0047), 0.7), (int(SR * 0.0019), 0.7)):
        buf = [0.0] * d
        idx = 0
        for i in range(N):
            v = buf[idx]
            y = -g * out[i] + v
            buf[idx] = out[i] + g * y
            out[i] = y
            idx = (idx + 1) % d

    return [ch[i] * (1 - wet) + out[i] * wet for i in range(N)]


# Slightly different comb lengths per channel: that mismatch is what makes the room feel wide.
L = reverb(L, [(1559, 0.78), (1693, 0.76), (1867, 0.74), (2053, 0.72)])
R = reverb(R, [(1601, 0.78), (1741, 0.76), (1913, 0.74), (2099, 0.72)])


# --- master --------------------------------------------------------------------------

def saturate(x):
    """Gentle soft-clip. Rounds the peaks and adds the low-order harmonics that read as warmth."""
    return math.tanh(x * 1.18) / math.tanh(1.18)


peak = max(max(abs(v) for v in L), max(abs(v) for v in R)) or 1.0
gain = 0.86 / peak

fade = int(SR * 0.14)
for i in range(fade):
    k = 1.0 - i / fade
    L[N - fade + i] *= k
    R[N - fade + i] *= k

out_path = sys.argv[1] if len(sys.argv) > 1 else 'launch_sfx.wav'
with wave.open(out_path, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = bytearray()
    for i in range(N):
        for ch in (L, R):
            s = max(-1.0, min(1.0, saturate(ch[i] * gain)))
            frames += struct.pack('<h', int(s * 32767))
    w.writeframes(bytes(frames))

print(f'wrote {out_path}  {DUR:.2f}s stereo  peak before normalise {peak:.3f}  gain {gain:.2f}')
