#!/usr/bin/env python3
"""Measure a sound into a comparable spec.

    python3 -I tools/sound_spec.py <file.wav> [more.wav ...]

Used to turn reference clips into hard numbers — loudness, attack, decay, spectral balance, pitch
content — so our own sting can be judged against a target instead of against my opinion. Measures
only; nothing here copies or transforms the input.

Stdlib only (no numpy on this machine), so the DFT is decimated and deliberately coarse. The
figures are for comparing like with like, not for mastering.
"""
import math
import struct
import sys
import wave

NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def note_of(f):
    if f <= 0:
        return '--'
    m = round(69 + 12 * math.log2(f / 440))
    return f'{NAMES[m % 12]}{m // 12 - 1}'


def read(path):
    w = wave.open(path, 'rb')
    n, sr, ch, sw = w.getnframes(), w.getframerate(), w.getnchannels(), w.getsampwidth()
    raw = w.readframes(n)
    frames = len(raw) // (sw * ch)
    x = []
    for i in range(frames):
        o = i * sw * ch
        b = raw[o:o + sw]
        if sw == 2:
            v = struct.unpack('<h', b)[0] / 32768
        elif sw == 3:
            v = int.from_bytes(b, 'little', signed=True) / 8388608
        elif sw == 4:
            v = struct.unpack('<i', b)[0] / 2147483648
        else:
            v = (b[0] - 128) / 128
        x.append(v)
    return x, sr


def spectrum(x, sr, start, size=4096, step=4):
    """Coarse magnitude spectrum of one window, as (freq, magnitude) pairs."""
    win = x[start:start + size]
    if len(win) < size:
        win = win + [0.0] * (size - len(win))
    win = [v * (0.5 - 0.5 * math.cos(2 * math.pi * i / size)) for i, v in enumerate(win)]
    out = []
    for k in range(2, size // 8):
        f = k * sr / size
        if f > 12000:
            break
        re = sum(win[i] * math.cos(-2 * math.pi * k * i / size) for i in range(0, size, step))
        im = sum(win[i] * math.sin(-2 * math.pi * k * i / size) for i in range(0, size, step))
        out.append((f, math.hypot(re, im)))
    return out


def measure(path):
    x, sr = read(path)
    n = len(x)
    peak = max(abs(v) for v in x) or 1e-9
    rms = math.sqrt(sum(v * v for v in x) / n)

    # loudest 400 ms window — where the sound actually lives
    w = int(sr * 0.4)
    best_i, best_r = 0, 0.0
    for i in range(0, max(1, n - w), int(sr * 0.02)):
        seg = x[i:i + w]
        r = math.sqrt(sum(v * v for v in seg) / len(seg))
        if r > best_r:
            best_r, best_i = r, i

    # attack: onset (first sample over 5% of peak) to 90% of peak
    onset = next((i for i, v in enumerate(x) if abs(v) > 0.05 * peak), 0)
    at90 = next((i for i, v in enumerate(x[onset:], onset) if abs(v) >= 0.9 * peak), onset)
    attack_ms = (at90 - onset) / sr * 1000

    # decay: from the peak down to -20 dB of it, in 10 ms windows
    pk_i = max(range(n), key=lambda i: abs(x[i]))
    target = peak * 0.1
    dec = n - pk_i
    step = int(sr * 0.01)
    for i in range(pk_i, n - step, step):
        seg = x[i:i + step]
        if math.sqrt(sum(v * v for v in seg) / len(seg)) < target:
            dec = i - pk_i
            break
    decay_ms = dec / sr * 1000

    # dead air: 20 ms windows under -45 dBFS, across the sounding part
    wv = int(sr * 0.02)
    quiet = total = 0
    for i in range(onset, n - wv, wv):
        seg = x[i:i + wv]
        total += 1
        if math.sqrt(sum(v * v for v in seg) / len(seg)) < 0.0056:
            quiet += 1
    dead = quiet * 100 / max(1, total)

    # Take the spectrum at the loudest ANALYSIS window, not at the start of the loudest 400 ms.
    # On sparse material the 400 ms window often begins in the silence before a hit, and the
    # spectrum then reads as all zeros.
    sw = 4096
    sp_i, sp_r = best_i, -1.0
    for i in range(best_i, min(best_i + w, n - sw), sw // 4):
        seg = x[i:i + sw]
        r = math.sqrt(sum(v * v for v in seg) / len(seg))
        if r > sp_r:
            sp_r, sp_i = r, i
    sp = spectrum(x, sr, sp_i)
    tot = sum(m for _, m in sp) or 1
    centroid = sum(f * m for f, m in sp) / tot
    low = sum(m for f, m in sp if f < 300) / tot * 100
    mid = sum(m for f, m in sp if 300 <= f < 3000) / tot * 100
    high = sum(m for f, m in sp if f >= 3000) / tot * 100
    # rolloff: frequency below which 85% of the energy sits
    acc, roll = 0.0, sp[-1][0]
    for f, m in sp:
        acc += m
        if acc >= 0.85 * tot:
            roll = f
            break

    print(f'\n=== {path.split("/")[-1]} ===')
    print(f'  duration      {n / sr:6.2f} s')
    print(f'  peak          {peak:6.3f}      RMS {rms:.3f}      crest {20 * math.log10(peak / max(rms, 1e-9)):5.1f} dB')
    print(f'  attack        {attack_ms:6.0f} ms     decay to -20 dB {decay_ms:5.0f} ms')
    print(f'  dead air      {dead:6.1f} %')
    print(f'  centroid      {centroid:6.0f} Hz     85% rolloff {roll:5.0f} Hz')
    print(f'  balance       low {low:4.1f} %   mid {mid:4.1f} %   high {high:4.1f} %')

    # pitch track over the sounding part
    notes = []
    t = onset / sr
    while t < min(n / sr - 0.1, (onset / sr) + 3.0):
        sp2 = spectrum(x, sr, int(t * sr), 4096, 6)
        band = [(f, m) for f, m in sp2 if 150 < f < 2600]
        if band:
            m, f = max((m, f) for f, m in band)
            seg = x[int(t * sr):int(t * sr) + int(sr * 0.05)]
            if seg and math.sqrt(sum(v * v for v in seg) / len(seg)) > peak * 0.05:
                notes.append((round(t, 2), note_of(f), round(f)))
        t += 0.06
    # collapse repeats
    seq, last = [], None
    for tt, nm, f in notes:
        if nm != last:
            seq.append(f'{nm}@{tt:.2f}')
            last = nm
    print(f'  pitch track   {" ".join(seq[:14])}')


for p in sys.argv[1:]:
    measure(p)
