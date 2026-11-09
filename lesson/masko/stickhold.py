#!/usr/bin/env python3
"""Hold the pointer stick at one angle for a whole clip, by redrawing it frame by frame.

    python3 -I masko/stickhold.py clips/v8_narrate_closed.mp4 clips/v8_narrate_held.mp4 11.7

Measured on the narration clip, the generator holds the stick at the pinned +12 degrees for the
first six frames and the last sixteen, and spends the 85 frames in between somewhere between +34
and +67 — pointing well above the speech bubble. 78% of the clip. The prompt forbids it in three
separate places and it happens anyway.

Rotating what is there will not do, because the rod is redrawn longer as well (24% of body height
at the ends, 35% in the middle). So erase it and draw a fresh one: from the grip the generator
chose, at the angle we want, at the length the reference has. The rod is a plain capsule, so it
reconstructs exactly — gold fill, dark outline, rounded ends, all sampled from the frame itself.

The grip end moves with the paw, frame to frame, so the stick stays attached to whatever the
character is doing. Only its angle and length are forced.
"""
import math
import os
import subprocess
import sys

src, out = sys.argv[1], sys.argv[2]
TARGET = float(sys.argv[3]) if len(sys.argv) > 3 else 11.7
LEN_PCT = float(sys.argv[4]) if len(sys.argv) > 4 else 0.24

d = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                    'stream=width,height,r_frame_rate', '-of', 'csv=p=0', src],
                   capture_output=True, text=True).stdout.strip().split(',')
W, H, fps = int(d[0]), int(d[1]), eval(d[2])
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                      '-'], capture_output=True).stdout
FS = W * H * 3
GREEN = (9, 174, 79)


def run_frame(buf):
    g = lambda x, y: (buf[(y * W + x) * 3], buf[(y * W + x) * 3 + 1], buf[(y * W + x) * 3 + 2])

    def p(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            i = (y * W + x) * 3
            buf[i], buf[i + 1], buf[i + 2] = c

    gold = lambda c: c[0] > 140 and 100 < c[1] < 205 and c[2] < 120
    purple = lambda c: c[0] > 60 and c[2] > 90 and c[1] < c[0] * 0.85 and sum(c) > 135
    body = [(x, y) for y in range(0, H, 2) for x in range(0, W, 2) if purple(g(x, y))]
    if not body:
        return False
    by = [q[1] for q in body]
    top, bot = min(by), max(by)
    h = bot - top
    cut = top + int(h * 0.46)
    stick = [(x, y) for y in range(cut, H) for x in range(W) if gold(g(x, y))]
    if len(stick) < 60:
        return False

    # the grip is the stick end nearest the body's horizontal centre
    cx = sum(q[0] for q in body) / len(body)
    ends = (min(stick, key=lambda q: q[0]), max(stick, key=lambda q: q[0]),
            min(stick, key=lambda q: q[1]), max(stick, key=lambda q: q[1]))
    grip = min(ends, key=lambda q: abs(q[0] - cx))
    far = max(stick, key=lambda q: (q[0] - grip[0]) ** 2 + (q[1] - grip[1]) ** 2)

    # sample the rod's own colours before erasing
    fill = g(*min(stick, key=lambda q: (q[0] - (grip[0] + far[0]) // 2) ** 2))
    edge = (62, 22, 92)
    for x, y in stick:
        for dx in (-5, 5):
            c = g(max(0, min(W - 1, x + dx)), y)
            if not gold(c) and sum(c) < 300:
                edge = c
                break

    # erase along the old axis
    L0 = math.hypot(far[0] - grip[0], far[1] - grip[1]) or 1
    ux, uy = (far[0] - grip[0]) / L0, (far[1] - grip[1]) / L0
    R = max(8, int(h * 0.022))
    for s in range(0, int(L0) + 2 * R):
        bx, byy = grip[0] + ux * s, grip[1] + uy * s
        for dx in range(-R, R + 1):
            for dy in range(-R, R + 1):
                if dx * dx + dy * dy <= R * R and not purple(g(max(0, min(W - 1, int(bx) + dx)),
                                                               max(0, min(H - 1, int(byy) + dy)))):
                    p(int(bx) + dx, int(byy) + dy, GREEN)

    # draw the new rod: outline capsule first, then the gold core
    rad = math.radians(TARGET)
    dirx, diry = math.cos(rad), -math.sin(rad)
    L = h * LEN_PCT
    half = max(3, int(h * 0.009))
    for pass_no, (col, rr) in enumerate(((edge, half + 3), (fill, half))):
        for s in range(0, int(L)):
            bx, byy = grip[0] + dirx * s, grip[1] + diry * s
            for dx in range(-rr, rr + 1):
                for dy in range(-rr, rr + 1):
                    if dx * dx + dy * dy <= rr * rr:
                        p(int(bx) + dx, int(byy) + dy, col)
    return True


frames = []
fixed = 0
for k in range(len(raw) // FS):
    buf = bytearray(raw[k * FS:(k + 1) * FS])
    if run_frame(buf):
        fixed += 1
    frames.append(bytes(buf))

subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                '-s', f'{W}x{H}', '-r', str(fps), '-i', '-', '-c:v', 'libx264', '-crf', '16',
                '-pix_fmt', 'yuv420p', out], input=b''.join(frames), check=True)
print(f'{os.path.basename(src)}  {len(frames)} frames at {W}x{H}')
print(f'  redrew the stick on {fixed} of them at {TARGET:+.1f} deg, '
      f'{LEN_PCT * 100:.0f}% of body height')
print(f'  -> {os.path.basename(out)}')
