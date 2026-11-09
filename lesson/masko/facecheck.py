#!/usr/bin/env python3
"""Check the character still looks like itself across a clip, and SHOW the worst frames.

    python3 -I masko/facecheck.py clips/idle_closed.mp4 aligned/idle.png out/faces.png

`loopcheck.py` measures motion and `loopclose.py` measures the join. Both passed cleanly on an
idle whose mouth had become a dark gaping hole for the whole clip and whose two blunt teeth had
vanished entirely. Nothing was wrong with the motion. The character had simply stopped being the
character, and no amount of measuring step sizes was ever going to say so.

So this measures identity instead of motion: it crops the head out of every frame, lines it up
with the head in the source pose, and reports how far each one has drifted.

And then it writes a contact sheet of the worst offenders next to the source, because the number
alone is not the point — the point is to look.
"""
import os
import subprocess
import sys

clip = sys.argv[1]
pose = sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else 'out/faces.png'
WORST = 5
N = 96
px = N * N
GREEN = (9, 174, 79)


def frames(path, pix='rgb24', n=N, single=False):
    cmd = ['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={n}:{n}',
           '-f', 'rawvideo', '-pix_fmt', pix, '-']
    raw = subprocess.run(cmd, capture_output=True).stdout
    step = n * n * (3 if pix == 'rgb24' else 1)
    return [raw[i * step:(i + 1) * step] for i in range(len(raw) // step)]


def bbox(f):
    xs, ys = [], []
    for y in range(N):
        for x in range(N):
            i = (y * N + x) * 3
            if (abs(f[i] - GREEN[0]) + abs(f[i + 1] - GREEN[1])
                    + abs(f[i + 2] - GREEN[2])) > 120:
                xs.append(x)
                ys.append(y)
    return (min(xs), max(xs), min(ys), max(ys)) if xs else None


def head_patch(f, box, size=28):
    """The head, resampled to a fixed grid so two frames can be compared whatever the body did.

    Taking the top 45% of the character's own bounding box means a frame where the mascot has
    bounced or leaned still lines up with the source — otherwise this would report the bounce as
    an identity change and miss the thing it is looking for.
    """
    x0, x1, y0, y1 = box
    hy1 = y0 + int((y1 - y0) * 0.45)
    out_px = []
    for j in range(size):
        for i in range(size):
            sx = x0 + (x1 - x0) * i // max(size - 1, 1)
            sy = y0 + (hy1 - y0) * j // max(size - 1, 1)
            k = (min(sy, N - 1) * N + min(sx, N - 1)) * 3
            out_px.append((f[k] + f[k + 1] + f[k + 2]) // 3)
    return out_px


src = frames(pose)[0]
sbox = bbox(src)
if not sbox:
    sys.exit(f'{pose}: no character found against the green')
ref = head_patch(src, sbox)

fr = frames(clip)
scores = []
for n, f in enumerate(fr):
    box = bbox(f)
    if not box:
        continue
    p = head_patch(f, box)
    scores.append((sum(abs(p[i] - ref[i]) for i in range(len(ref))) / len(ref), n))

scores.sort(reverse=True)
mean = sum(s for s, _ in scores) / len(scores)
print(f'{os.path.basename(clip)} vs {os.path.basename(pose)}   {len(fr)} frames')
print(f'  mean head drift   {mean:.1f}')
print(f'  worst frames      ' + ', '.join(f'{n} ({s:.1f})' for s, n in scores[:WORST]))
print(f'  best frame        {scores[-1][1]} ({scores[-1][0]:.1f})')

# The contact sheet is the whole point: the source head first, then the worst frames beside it.
os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
tmp = os.path.join(os.path.dirname(out) or '.', '_fc')
os.makedirs(tmp, exist_ok=True)
sel = [n for _, n in scores[:WORST]]

dims = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                       'stream=width,height', '-of', 'csv=p=0', pose],
                      capture_output=True, text=True).stdout.strip().split(',')
sw, sh = int(dims[0]), int(dims[1])
cx0, cx1, cy0, cy1 = sbox
# the source head box in source pixels, padded a little
px0 = max(0, int(cx0 / N * sw) - 20)
py0 = max(0, int(cy0 / N * sh) - 20)
pw = int((cx1 - cx0) / N * sw) + 40
ph = int((cy1 - cy0) * 0.5 / N * sh) + 40
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', pose, '-vf',
                f'crop={pw}:{ph}:{px0}:{py0},scale=300:250', f'{tmp}/a_source.png'], check=True)
for k, n in enumerate(sel):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', clip, '-vf',
                    f"select='eq(n\\,{n})',crop={pw}:{ph}:{px0}:{py0},scale=300:250",
                    '-frames:v', '1', f'{tmp}/b_{k}.png'], check=True)

ins = []
for f in [f'{tmp}/a_source.png'] + [f'{tmp}/b_{k}.png' for k in range(len(sel))]:
    ins += ['-i', f]
cnt = len(sel) + 1
subprocess.run(['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex',
                ''.join(f'[{i}]' for i in range(cnt)) + f'hstack=inputs={cnt}', out], check=True)
print(f'\n  wrote {out}   (source first, then frames {sel})')
print('  LOOK AT IT.')
