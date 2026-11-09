#!/usr/bin/env python3
"""Measure whether a generated clip is a real cycle or a drift-and-snap.

    python3 -I masko/loopcheck.py clips/idle_loop_raw.mp4

The whole clip model rests on one assumption: that passing the same pose as both `startFrame` and
`endFrame` makes the model return to where it began, rather than wander off and cut back on the
last frame. Eyeballing cannot tell those apart — a snap lasts one frame at 24 fps — so this
measures it.

Two numbers per frame, against frame 0:

  diff   mean absolute pixel difference, the whole frame. How far from home this frame is.
  step   mean absolute difference from the PREVIOUS frame. How fast it is moving right now.

A true cycle: diff rises, falls back to near zero by the end, and step stays smooth throughout.
A drift-and-snap: diff stays high at the end, and step spikes hard on the final frame as the
model jumps back to the pinned end frame.

So the test is the last step value against the median step. A cycle keeps that ratio near 1.
"""
import os
import subprocess
import sys

src = sys.argv[1]
N = 64                                  # probe resolution; enough to see motion, cheap to scan

probe = subprocess.run(
    ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames',
     '-show_entries', 'stream=nb_read_frames,r_frame_rate', '-of', 'csv=p=0', src],
    capture_output=True, text=True).stdout.strip().split(',')
num, rate = probe[1], probe[0]
fps = eval(rate) if '/' in rate else float(rate)
total = int(num)

raw = subprocess.run(
    ['ffmpeg', '-v', 'error', '-i', src, '-vf', f'scale={N}:{N}',
     '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
    capture_output=True).stdout

px = N * N
frames = [raw[i * px:(i + 1) * px] for i in range(len(raw) // px)]
first = frames[0]


def mad(a, b):
    return sum(abs(a[i] - b[i]) for i in range(px)) / px


diffs = [mad(f, first) for f in frames]
steps = [0.0] + [mad(frames[i], frames[i - 1]) for i in range(1, len(frames))]

body = sorted(steps[1:])
median_step = body[len(body) // 2]
last_step = steps[-1]
peak = max(diffs)

print(f'{os.path.basename(src)}   {len(frames)} frames @ {fps:.0f} fps '
      f'= {len(frames) / fps:.2f}s\n')
print(f'{"t":>6}{"diff from frame 0":>20}{"step":>10}')
for i in range(0, len(frames), max(1, len(frames) // 16)):
    bar = '#' * int(diffs[i] / max(peak, 0.001) * 30)
    print(f'{i / fps:6.2f}{diffs[i]:20.2f}{steps[i]:10.2f}  {bar}')
print(f'{(len(frames) - 1) / fps:6.2f}{diffs[-1]:20.2f}{steps[-1]:10.2f}  '
      f'{"#" * int(diffs[-1] / max(peak, 0.001) * 30)}   <- last frame')

print(f'\npeak distance from frame 0   {peak:.2f}')
print(f'distance at the last frame   {diffs[-1]:.2f}  '
      f'({diffs[-1] / max(peak, 0.001) * 100:.0f}% of peak)')
print(f'median step between frames   {median_step:.2f}')
print(f'step onto the last frame     {last_step:.2f}  '
      f'({last_step / max(median_step, 0.001):.1f}x median)')

verdict = 'CYCLE' if last_step < median_step * 3 and diffs[-1] < peak * 0.35 else 'SNAP'
print(f'\n{verdict}')

# Dead time: how much of the clip is barely moving. A loop that holds still for long stretches
# reads as FROZEN rather than resting, and it reads that way much sooner at the size the mascot
# actually appears on screen — about 40 px wide beside the question. Low amplitude is fine; gaps
# are not.
#
# Measured against the clip's PEAK step, not its median. Video compression puts a noise floor
# under every frame, so a still frame still reports a small non-zero step; a threshold set off the
# median lands under that floor and declares the whole clip alive. The first version of this did
# exactly that and scored a clip with visible dead stretches at 3%.
peak_step = max(steps)
dead = sum(1 for s in steps[1:] if s < peak_step * 0.15)
print(f'dead time  {dead}/{len(steps) - 1} frames '
      f'({dead / (len(steps) - 1) * 100:.0f}% of the clip barely moving)')

# Where the motion actually finishes, so the clip can be trimmed to it. Scans back for the last
# frame still moving at a fifth of the median rate; everything after that is a dead hold.
tail = len(frames) - 1
while tail > 1 and steps[tail] < median_step * 0.2:
    tail -= 1
print(f'motion ends at {tail / fps:.2f}s of {len(frames) / fps:.2f}s')
