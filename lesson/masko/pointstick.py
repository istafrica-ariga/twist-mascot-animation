#!/usr/bin/env python3
"""Rotate the pointer stick in a pose still, instead of asking the generator to redraw it.

    python3 -I masko/pointstick.py aligned/idle.png aligned/narrating.png 10

Four generations of a "pointing" pose failed. Asked for the stick raised, the generator drew it at
+64 degrees, pointing at the ceiling. Pushed toward level, it drew a level stick on a DIFFERENT
character — bat wings, bigger ears, bigger head, a long wand. Pointing with a stick is an
illustration archetype it already knows, and ours is not it.

But the correct character already exists in `idle.png`, and the only thing wrong with it is the
angle of one thin rod. So rotate that rod. The stick sits entirely below the glasses in y, is the
only gold in the lower half of the frame, and lies over flat green, so it lifts out cleanly.

Nothing about the character changes, because nothing about the character is touched.
"""
import math
import os
import subprocess
import sys

src, out = sys.argv[1], sys.argv[2]
TARGET = float(sys.argv[3]) if len(sys.argv) > 3 else 10.0   # degrees above horizontal
LIFT = int(sys.argv[4]) if len(sys.argv) > 4 else 0          # px to raise the grip

d = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                    'stream=width,height', '-of', 'csv=p=0', src],
                   capture_output=True, text=True).stdout.strip().split(',')
W, H = int(d[0]), int(d[1])
raw = bytearray(subprocess.run(['ffmpeg', '-v', 'error', '-i', src,
                                '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                               capture_output=True).stdout)
get = lambda x, y: (raw[(y * W + x) * 3], raw[(y * W + x) * 3 + 1], raw[(y * W + x) * 3 + 2])


def put(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        i = (y * W + x) * 3
        raw[i], raw[i + 1], raw[i + 2] = c


def is_gold(c):
    r, g, b = c
    return r > 140 and 100 < g < 205 and b < 120


def is_green(c):
    r, g, b = c
    return abs(r - 9) < 60 and g > 120 and abs(b - 79) < 70 and g > r and g > b


# The glasses are gold too, so take only the gold below the gap. Find the gap from the histogram.
rows = sorted({y for y in range(H) for x in range(W) if is_gold(get(x, y))})
gaps = [(rows[i + 1] - rows[i], rows[i]) for i in range(len(rows) - 1)]
split = max(gaps)[1] if gaps else 0
stick = [(x, y) for y in range(split + 1, H) for x in range(W) if is_gold(get(x, y))]
if not stick:
    sys.exit(f'{src}: no stick found below y={split}')

# The outline belongs to the stick too: any dark pixel touching a gold one.
dark = set()
for x, y in stick:
    for dx in range(-7, 8):
        for dy in range(-7, 8):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H:
                c = get(nx, ny)
                if not is_gold(c) and not is_green(c) and sum(c) < 330:
                    dark.add((nx, ny))
sprite_px = set(stick) | dark

xs = [q[0] for q in stick]; ys = [q[1] for q in stick]
# the grip is the end nearest the body: the stick slants down-and-away, so that is the TOP end
grip = min(stick, key=lambda q: q[1])
tip = max(stick, key=lambda q: q[1])
cur = math.degrees(math.atan2(grip[1] - tip[1], tip[0] - grip[0]))
print(f'{os.path.basename(src)}  {W}x{H}')
print(f'  stick below y={split}: {len(stick)} gold + {len(dark)} outline px')
print(f'  grip {grip}  tip {tip}   current angle {cur:+.1f} deg')

sprite = {(x - grip[0], y - grip[1]): get(x, y) for x, y in sprite_px}

# Erasing only the classified pixels left a ghost: the dark outline merges with the paw's own
# outline and parts of it slip through any colour test. So sweep a disc along the OLD axis
# instead, which is geometry rather than classification and cannot miss.
#
# The sweep starts clear of the grip. Those pixels are the paw, not the stick, and the new rod is
# drawn from the same grip anyway, so it covers them.
GREEN = (9, 174, 79)
L = math.hypot(tip[0] - grip[0], tip[1] - grip[1])
ux, uy = (tip[0] - grip[0]) / L, (tip[1] - grip[1]) / L
R = 16
for s in range(26, int(L) + 2 * R):
    cx, cy = grip[0] + ux * s, grip[1] + uy * s
    for dx in range(-R, R + 1):
        for dy in range(-R, R + 1):
            if dx * dx + dy * dy <= R * R:
                put(int(cx) + dx, int(cy) + dy, GREEN)

rot = math.radians(TARGET - cur)
cs, sn = math.cos(rot), math.sin(rot)
gx, gy = grip[0], grip[1] - LIFT
placed = 0
for (dx, dy), c in sprite.items():
    # screen y is down, so a positive rotation about the grip is clockwise in maths terms
    nx = dx * cs + dy * sn
    ny = -dx * sn + dy * cs
    for ox in (0, 1):
        for oy in (0, 1):
            put(int(round(gx + nx)) + ox, int(round(gy + ny)) + oy, c)
    placed += 1

subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                '-s', f'{W}x{H}', '-i', '-', out], input=bytes(raw), check=True)
print(f'  rotated {placed} px by {TARGET - cur:+.1f} deg about the grip'
      + (f', grip lifted {LIFT} px' if LIFT else ''))
print(f'  -> {out}')
