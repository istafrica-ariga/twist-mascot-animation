#!/usr/bin/env python3
"""Synthesise the splash soundtrack, placed on the animation's own beats.

Nothing is sampled — every sound is built from noise and sine partials, so the timing lands
exactly on the frames and the result is ours to ship with no licence attached. Written with the
stdlib only (wave + math) so it runs anywhere without numpy.

Beats come from the retimed 4.04 s clip: crouch ~0.55, takeoff ~0.70, cloud burst ~0.82,
settle ~1.50, wordmark ~1.85, reward sparkle ~2.30.
"""
import math
import random
import struct
import sys
import wave

SR = 44100
DUR = 4.10
N = int(SR * DUR)

buf = [0.0] * N
rng = random.Random(7)          # fixed seed: regenerating gives the identical file


def at(t):
    return int(t * SR)


def env(i, n, attack, decay, curve=2.0):
    """Attack-then-decay envelope, both in samples, decay shaped by `curve`."""
    if i < attack:
        return (i / attack) ** 0.6 if attack else 1.0
    j = i - attack
    if j >= decay:
        return 0.0
    return (1.0 - j / decay) ** curve


def add(start, samples, gain=1.0):
    for k, v in enumerate(samples):
        idx = start + k
        if 0 <= idx < N:
            buf[idx] += v * gain


def whoosh(dur, f0, f1, q=0.22, seed_noise=None):
    """Filtered noise swept from f0 to f1 — a one-pole bandpass with a moving centre."""
    n = int(dur * SR)
    out = [0.0] * n
    lp = bp = 0.0
    attack, decay = int(n * 0.18), int(n * 0.82)
    for i in range(n):
        white = rng.uniform(-1, 1) if seed_noise is None else seed_noise[i]
        p = i / n
        # exponential sweep reads as acceleration; linear sounds mechanical
        f = f0 * (f1 / f0) ** (p ** 0.7)
        alpha = min(0.99, 2 * math.pi * f / SR)
        lp += alpha * (white - lp)          # low-pass arm
        bp += alpha * q * (lp - bp)         # subtract to get the band
        out[i] = (lp - bp) * env(i, n, attack, decay, 1.6)
    return out


def puff(dur=0.26):
    """Soft rounded air burst for the cloud puffs — low-passed noise, no transient bite."""
    n = int(dur * SR)
    out = [0.0] * n
    lp = 0.0
    for i in range(n):
        lp += 0.055 * (rng.uniform(-1, 1) - lp)
        out[i] = lp * env(i, n, int(n * 0.10), int(n * 0.90), 2.4)
    return out


def bell(freq, dur, detune=0.0):
    """A sine partial with a soft attack and long tail — the sparkle voice."""
    n = int(dur * SR)
    out = [0.0] * n
    attack = int(SR * 0.004)
    for i in range(n):
        t = i / SR
        a = env(i, n, attack, n - attack, 3.0)
        out[i] = (math.sin(2 * math.pi * freq * t)
                  + 0.30 * math.sin(2 * math.pi * freq * 2 * t)
                  + 0.12 * math.sin(2 * math.pi * (freq * 3 + detune) * t)) * a
    return out


def thump(dur=0.18, f=140.0):
    """Body-weight settle: a short pitch-dropping sine."""
    n = int(dur * SR)
    out = [0.0] * n
    phase = 0.0
    for i in range(n):
        p = i / n
        freq = f * (1.0 - 0.45 * p)
        phase += 2 * math.pi * freq / SR
        out[i] = math.sin(phase) * env(i, n, int(n * 0.04), int(n * 0.96), 2.2)
    return out


# --- the cue sheet -------------------------------------------------------------------

# 0.55 s — anticipation. A short downward brush as the knees bend.
add(at(0.55), whoosh(0.18, 1800, 600), 0.16)

# 0.70 s — takeoff. The main event: a fast upward sweep, and the loudest thing in the mix.
add(at(0.68), whoosh(0.42, 420, 5200), 0.62)

# 0.82 s — the cloud puffs, two of them, offset so they read as separate shapes.
add(at(0.80), puff(0.30), 0.30)
add(at(0.87), puff(0.24), 0.20)

# 1.50 s — settle. Barely audible, just enough to give the body weight. Kept low deliberately:
# at 150 Hz this reads far louder on an RMS meter than it does to the ear, and at 0.14 it was
# measuring as the biggest event in the whole cue sheet.
add(at(1.50), thump(0.20, 150), 0.055)

# 1.85 s — wordmark. A rising arpeggio on a D-major triad, staggered into a sparkle.
for k, (f, delay) in enumerate([(587.33, 0.00), (739.99, 0.055), (880.00, 0.105),
                                (1174.66, 0.150)]):
    add(at(1.85 + delay), bell(f, 1.5 - 0.15 * k), 0.085)

# 2.30 s — reward accent. Two tiny high twinkles.
add(at(2.30), bell(1760.0, 0.42, 3.0), 0.045)
add(at(2.46), bell(2349.3, 0.34, -4.0), 0.032)

# --- master --------------------------------------------------------------------------

peak = max(abs(v) for v in buf) or 1.0
target = 0.80
gain = target / peak

# gentle fade-out over the last 120 ms so the file never clicks at the end
fade = int(SR * 0.12)
for i in range(fade):
    buf[N - fade + i] *= (1.0 - i / fade)

out_path = sys.argv[1] if len(sys.argv) > 1 else 'launch_sfx.wav'
with wave.open(out_path, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = bytearray()
    for v in buf:
        s = max(-1.0, min(1.0, v * gain))
        frames += struct.pack('<h', int(s * 32767))
    w.writeframes(bytes(frames))

print(f'wrote {out_path}  {DUR:.2f}s  peak before normalise {peak:.3f}  gain {gain:.2f}')
