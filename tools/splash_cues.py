#!/usr/bin/env python3
"""The splash sound, built to the measured spec in out/masko_redo/audio/TARGET.md.

    python3 -I tools/splash_cues.py <out.wav>

Four earlier attempts were rejected. The fifth is not another opinion — every choice here is
pinned to a number measured off reference clips:

    energy below 300 Hz   under 5 %      (so: no kick, no sub, no bassline, nothing under C4)
    register              C5-C7
    spectral centroid     1800-2000 Hz
    decay to -20 dB       120-180 ms     (short and dry; the references are gone in 120)
    RMS                   0.035-0.050
    peak                  0.40-0.50
    crest factor          19-23 dB       (so: no bus compression, transients left alone)
    dead air              40-60 %        (space is the aesthetic, not a fault to fill)

Stdlib only. Additive, because explicit partials are the only way to aim a spectral centroid.
"""
import math
import struct
import sys
import wave

SR = 48000
DUR = 3.60
N = int(SR * DUR)
L = [0.0] * N
R = [0.0] * N

# Pitches, all high. Nothing below C5 is allowed to carry weight.
def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)

C5, E5, G5, A5, C6, D6, E6, G6, A6, C7, E7 = 72, 76, 79, 81, 84, 86, 88, 91, 93, 96, 100

# A music-box partial set: strong fundamental, a bright second and third, and two
# inharmonic upper partials that decay fast. The uppers are what pull the centroid to
# ~1900 Hz without making the thing shrill.
PARTIALS = [
    (1.00, 1.00, 1.00),
    (2.01, 0.42, 0.55),
    (3.02, 0.22, 0.38),
    (4.21, 0.075, 0.26),
    (5.63, 0.03, 0.18),   # trimmed twice: 0.07 measured 2215 Hz and 0.04 still 2150, over target
]

# 150 ms from peak to -20 dB: 0.1 = exp(-0.150 / tau)
TAU = 0.150 / math.log(10)


def ding(t0, note, gain=1.0, pan=0.0, tau=TAU, bend=0.012):
    """One struck note. Fast attack, exponential decay, tiny pitch settle on the attack."""
    f0 = hz(note)
    i0 = int(t0 * SR)
    length = int(min(tau * 7, 1.1) * SR)
    attack = int(0.0025 * SR)
    lg = gain * math.cos((pan + 1) * math.pi / 4)
    rg = gain * math.sin((pan + 1) * math.pi / 4)

    for ratio, amp, dmul in PARTIALS:
        tau_p = tau * dmul
        w = 2 * math.pi * f0 * ratio / SR
        phase = 0.0
        for i in range(length):
            idx = i0 + i
            if idx >= N:
                break
            b = bend * math.exp(-i / (0.018 * SR))
            phase += w * (1.0 + b)
            if i < attack:
                e = i / attack
            else:
                e = math.exp(-(i - attack) / (tau_p * SR))
                # Only give up once the tail is genuinely inaudible. Testing this during the
                # attack breaks out at i == 0, where the ramp is still zero — which silenced
                # every pitched note and left only the ticks.
                if e < 0.0005:
                    break
            v = math.sin(phase) * amp * e
            L[idx] += v * lg
            R[idx] += v * rg


def tick(t0, gain=0.35, pan=0.0):
    """A tiny high transient — the only non-pitched thing, and it is band-limited well
    above 300 Hz so it cannot contribute low energy."""
    i0 = int(t0 * SR)
    length = int(0.05 * SR)
    hp = 0.0
    prev = 0.0
    seed = 7
    lg = gain * math.cos((pan + 1) * math.pi / 4)
    rg = gain * math.sin((pan + 1) * math.pi / 4)
    for i in range(length):
        idx = i0 + i
        if idx >= N:
            break
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        x = (seed / 0x3FFFFFFF) - 1.0
        hp = 0.88 * (hp + x - prev)          # high-pass: keeps it in the air, out of the lows
        prev = x
        e = math.exp(-i / (0.010 * SR))
        v = hp * e
        L[idx] += v * lg
        R[idx] += v * rg


# ---------------------------------------------------------------------------
# The cue sheet. Four moments, and a lot of silence between them — the
# references leave 50-67 % of the clip near silence, and that space is the
# sound as much as the notes are.
# ---------------------------------------------------------------------------

# 0.58  the crouch: one small tick, barely there
tick(0.58, 0.30, -0.15)
ding(0.58, G5, 0.22, -0.15, tau=TAU * 0.7)

# 0.68  TAKEOFF: a quick rising figure, three notes, 55 ms apart, spread as it climbs
for j, (n, pan) in enumerate([(C6, -0.35), (E6, 0.0), (G6, 0.35)]):
    ding(0.68 + j * 0.055, n, 0.72 - j * 0.04, pan)
tick(0.68, 0.45, 0.0)

# 0.86  the top of the climb — one bright note landing an octave up
ding(0.86, C7, 0.50, 0.12, tau=TAU * 0.85)

# 0.98-1.45  the ascent and hover. Not silence: a thin line of quiet notes that keeps
# the clip breathing without ever competing with the two loud moments. At nothing here
# the mix measured 70 % dead air and RMS 0.024, both outside the spec.
for t, n, g, pan in [(0.98, G6, 0.27, -0.3), (1.10, E6, 0.23, 0.25),
                     (1.26, C6, 0.24, -0.2), (1.42, G5, 0.26, 0.3)]:
    ding(t, n, g, pan, tau=TAU * 1.0)

# 1.62-1.76  two low taps leading into the reveal, pulling the centre of the sound down
ding(1.62, C5, 0.34, -0.15, tau=TAU * 1.3)
ding(1.76, G5, 0.34, 0.15, tau=TAU * 1.1)

# 1.85  THE WORDMARK: the reward. A C major triad struck together, spread wide,
# with the octave on top a beat behind it so it opens rather than thuds.
# Struck a few milliseconds apart rather than together: identical onsets sum coherently
# into one spike that dominates the peak, which pushed crest factor to 25 dB against a
# 19-23 target. Real players never land a chord to the sample either.
for j, (n, pan, g) in enumerate([(C6, -0.45, 0.62), (E6, 0.0, 0.58), (G6, 0.45, 0.55)]):
    ding(1.85 + j * 0.006, n, g, pan, tau=TAU * 1.5)
ding(1.925, C7, 0.52, 0.0, tau=TAU * 1.8)
tick(1.85, 0.40, 0.0)

# 2.30  two tiny flecks as the sparkles land
ding(2.30, E7, 0.20, -0.5, tau=TAU * 0.9)
ding(2.40, C7 + 7, 0.15, 0.5, tau=TAU * 0.8)


# ---------------------------------------------------------------------------
# Master: normalise to a target PEAK only. No compression — crest factor is in
# the spec at 19-23 dB, and a bus compressor is exactly what flattened the last
# attempt to 16.5.
# ---------------------------------------------------------------------------
TARGET_PEAK = 0.45

peak = max(max(abs(v) for v in L), max(abs(v) for v in R)) or 1.0
g = TARGET_PEAK / peak

fade = int(0.08 * SR)
for i in range(fade):
    k = 1.0 - i / fade
    L[N - fade + i] *= k
    R[N - fade + i] *= k

# ---------------------------------------------------------------------------
# Haptics, from this same cue sheet so the two cannot drift apart. Only the
# moments that carry weight get one — the quiet ascent notes are texture, and
# buzzing on every one of them would turn the whole clip into a rumble.
# ---------------------------------------------------------------------------
HAPTICS = [
    ('transient', 0.58, 0.20, 0.35, None, None),
    ('continuous', 0.68, 0.70, 0.45, 0.14, (1.0, 0.2)),
    ('transient', 0.68, 0.90, 0.70, None, None),
    ('transient', 0.86, 0.45, 0.80, None, None),
    ('transient', 1.76, 0.30, 0.50, None, None),
    ('transient', 1.85, 0.95, 0.75, None, None),
    ('continuous', 1.85, 0.35, 0.55, 0.32, (1.0, 0.1)),
    ('transient', 2.30, 0.18, 1.00, None, None),
    ('transient', 2.40, 0.14, 1.00, None, None),
]


def write_ahap(path, audio_file='twist_launch.wav'):
    def P(pid, v):
        return {'ParameterID': pid, 'ParameterValue': round(v, 3)}

    pattern = [{'Event': {'Time': 0, 'EventType': 'AudioCustom',
                          'EventWaveformPath': audio_file,
                          'EventParameters': [P('AudioVolume', 1)]}}]
    for kind, t, i, s, d, ramp in HAPTICS:
        if kind == 'transient':
            pattern.append({'Event': {'Time': t, 'EventType': 'HapticTransient',
                                      'EventParameters': [P('HapticIntensity', i), P('HapticSharpness', s)]}})
        else:
            pattern.append({'Event': {'Time': t, 'EventType': 'HapticContinuous', 'EventDuration': d,
                                      'EventParameters': [P('HapticIntensity', i), P('HapticSharpness', s)]}})
            if ramp:
                pattern.append({'ParameterCurve': {'ParameterID': 'HapticIntensityControl', 'Time': t,
                                                   'ParameterCurveControlPoints': [
                                                       {'Time': 0, 'ParameterValue': ramp[0]},
                                                       {'Time': d, 'ParameterValue': ramp[1]}]}})
    import json  # noqa: PLC0415 - only needed when exporting
    ahap = {'Version': 1.0,
            'Metadata': {'Project': 'Twist Splash', 'Created': 'cue sheet in tools/splash_cues.py'},
            'Pattern': pattern}
    with open(path, 'w') as f:
        json.dump(ahap, f, indent=2)
        f.write('\n')
    return len(HAPTICS)


out = sys.argv[1] if len(sys.argv) > 1 else 'splash.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = bytearray()
    for i in range(N):
        for ch in (L, R):
            s = max(-1.0, min(1.0, ch[i] * g))
            frames += struct.pack('<h', int(s * 32767))
    w.writeframes(bytes(frames))

mono = [(L[i] + R[i]) * 0.5 * g for i in range(N)]
rms = math.sqrt(sum(v * v for v in mono) / N)
print(f'wrote {out}  {DUR:.2f}s stereo  peak {TARGET_PEAK:.2f}  RMS {rms:.4f}  '
      f'crest {20 * math.log10(TARGET_PEAK / max(rms, 1e-9)):.1f} dB')

def write_android(path, step=10):
    """Android VibrationEffect.createWaveform: the same events as a run-length amplitude envelope."""
    import json  # noqa: PLC0415
    end = max(t + (d or 0.05) for _, t, _, _, d, _ in HAPTICS) + 0.05
    amp = [0] * int(math.ceil(end * 1000 / step))
    for kind, t, i, s, d, ramp in HAPTICS:
        i0 = round(t * 1000 / step)
        if kind == 'transient':
            n_steps = max(1, round((40 - 28 * s) / step))   # sharper taps are shorter
            for k in range(n_steps):
                if i0 + k < len(amp):
                    amp[i0 + k] = max(amp[i0 + k], round(i * 255))
        else:
            n_steps = round(d * 1000 / step)
            r0, r1 = ramp or (1.0, 1.0)
            for k in range(n_steps):
                if i0 + k < len(amp):
                    lvl = i * (r0 + (r1 - r0) * k / max(1, n_steps))
                    amp[i0 + k] = max(amp[i0 + k], round(lvl * 255))
    timings, amplitudes = [], []
    for a in amp:
        if amplitudes and amplitudes[-1] == a:
            timings[-1] += step
        else:
            timings.append(step)
            amplitudes.append(a)
    with open(path, 'w') as f:
        json.dump({'timings': timings, 'amplitudes': amplitudes}, f, indent=2)
        f.write('\n')
    return len(timings)


if len(sys.argv) > 2:
    n_h = write_ahap(sys.argv[2])
    print(f'wrote {sys.argv[2]}  {n_h} haptic events')
if len(sys.argv) > 3:
    n_s = write_android(sys.argv[3])
    print(f'wrote {sys.argv[3]}  {n_s} waveform segments')
