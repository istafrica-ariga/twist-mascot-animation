#!/usr/bin/env python3
"""Align the pose set to a common scale and ground line.

    python3 -I lesson/normalise.py

The generator will not hold framing reliably — measured across the first set, the character's
height varied by 21% and its feet sat 17 px apart on a 256 px reference. Between two poses pinned
as the ends of a clip, that reads as the mascot growing and sliding, and no prompt on the clip
fixes it.

So it is fixed here instead, deterministically: find each character's bounding box against the
green, scale every pose to one height, and put every pair of feet on one line. `yes_big` is a
jump, so it is scaled like the rest but deliberately lifted clear of the ground line.

Pure stdlib plus ffmpeg, as with everything else in this project.
"""
import math
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'masko', 'poses')
OUT = os.path.join(HERE, 'masko', 'aligned')
GREEN = (9, 174, 79)
SIZE = 1024                 # output canvas, square
TARGET_H = 700              # character height in the output, in pixels
GROUND = 880                # y of the ground line in the output
AIRBORNE = 110              # how far yes_big floats above it

POSES = ['idle', 'yes', 'yes_big', 'oops', 'go_on', 'narrate', 'watching', 'pleased', 'sheepish', 'narrating']


def bbox(path, probe=256):
    """Bounding box of everything that is not the green background, in source pixels."""
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={probe}:{probe}',
         '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        capture_output=True).stdout
    xs, ys = [], []
    for y in range(probe):
        for x in range(probe):
            i = (y * probe + x) * 3
            d = abs(raw[i] - GREEN[0]) + abs(raw[i + 1] - GREEN[1]) + abs(raw[i + 2] - GREEN[2])
            if d > 120:
                xs.append(x)
                ys.append(y)
    if not xs:
        raise SystemExit(f'{path}: found no character against the green')
    w, h = subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
         '-show_entries', 'stream=width,height', '-of', 'csv=p=0'],
        capture_output=True, text=True).stdout.strip().split(',') if False else (None, None)
    return min(xs) / probe, max(xs) / probe, min(ys) / probe, max(ys) / probe


os.makedirs(OUT, exist_ok=True)
hexgreen = '#%02x%02x%02x' % GREEN
report = []

for name in POSES:
    src = os.path.join(SRC, f'{name}.png')
    if not os.path.exists(src):
        print(f'{name}: missing, skipped')
        continue

    dims = subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
         '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src],
        capture_output=True, text=True).stdout.strip().split(',')
    sw, sh = int(dims[0]), int(dims[1])

    fx0, fx1, fy0, fy1 = bbox(src)
    cw, ch = (fx1 - fx0) * sw, (fy1 - fy0) * sh          # character size in source px
    cx = (fx0 + fx1) / 2 * sw                            # character centre x

    scale = TARGET_H / ch
    new_w, new_h = sw * scale, sh * scale
    # where the character lands after scaling
    new_cx = cx * scale
    new_feet = fy1 * sh * scale

    ground = GROUND - (AIRBORNE if name == 'yes_big' else 0)

    # Always pad out to a generous green margin and then crop back. Choosing between pad and crop
    # by sign looks tidier but breaks the moment one axis wants padding and the other cropping —
    # `watching` needed +31 across and -25 down, and crop refused the negative offset. Going
    # through a bigger canvas costs nothing and handles every combination of signs.
    m = SIZE
    cx_off = new_cx + m - SIZE / 2
    cy_off = new_feet + m - ground

    subprocess.run([
        'ffmpeg', '-v', 'error', '-y', '-i', src,
        '-vf', (f'scale={new_w:.0f}:{new_h:.0f}:flags=lanczos,'
                f'pad={new_w + 2 * m:.0f}:{new_h + 2 * m:.0f}:{m}:{m}:{hexgreen},'
                f'crop={SIZE}:{SIZE}:{cx_off:.0f}:{cy_off:.0f}'),
        os.path.join(OUT, f'{name}.png')], check=True)
    report.append((name, ch, scale))

print(f'{"pose":<9}{"source h":>10}{"scale":>8}')
for name, ch, scale in report:
    print(f'{name:<9}{ch:10.0f}{scale:8.3f}')
print(f'\nall aligned to height {TARGET_H} px, feet on y={GROUND} '
      f'({AIRBORNE} px of lift for yes_big)')
print(f'wrote {OUT}/')
