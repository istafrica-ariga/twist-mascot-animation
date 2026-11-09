#!/usr/bin/env python3
"""Find the frames where the two teeth have fused into one white band.

    python3 -I masko/mouthcheck.py clips/v7_narrate_raw.mp4

Two passes of prompting could not stop this. Told the teeth were two separate blunt tiles, the
generator still draws a single wide white band across the mouth — a plain toothy grin — in roughly
one frame in six of a talking clip. Naming the failure ("never a continuous band, never a row,
never a grin") moved it from 20% of frames to 16%. It is a habit, not a misunderstanding.

So measure it instead. In a correct open mouth the white is TWO small blobs with dark cavity
between them; in a broken one it is a single wide blob. Scan each row of the mouth region, count
the white runs, and take the widest single run as a fraction of the mouth width. Two tiles give a
narrow widest-run; a fused band gives a wide one.
"""
import subprocess
import sys

src = sys.argv[1]
THRESH = float(sys.argv[2]) if len(sys.argv) > 2 else 0.42
W = 160

cmd = ['ffmpeg', '-v', 'error', '-i', src, '-vf',
       f'crop=in_w*0.34:in_h*0.14:in_w*0.33:in_h*0.42,scale={W}:{W}',
       '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
raw = subprocess.run(cmd, capture_output=True).stdout
step = W * W * 3
frames = [raw[i * step:(i + 1) * step] for i in range(len(raw) // step)]

bad, scores = [], []
for n, f in enumerate(frames):
    widest = 0
    for y in range(W):
        run = 0
        for x in range(W):
            i = (y * W + x) * 3
            if f[i] > 200 and f[i + 1] > 200 and f[i + 2] > 200:
                run += 1
                widest = max(widest, run)
            else:
                run = 0
    s = widest / W
    scores.append(s)
    if s > THRESH:
        bad.append(n)

print(f'{src.split("/")[-1]}   {len(frames)} frames   threshold {THRESH}')
print(f'  widest white run, worst frames: '
      + ', '.join(f'{n}({scores[n]:.2f})' for n in sorted(bad, key=lambda n: -scores[n])[:8]))
print(f'  fused-band frames: {len(bad)}/{len(frames)} = {len(bad)/len(frames)*100:.0f}%')
if bad:
    runs, cur = [], [bad[0]]
    for n in bad[1:]:
        if n == cur[-1] + 1:
            cur.append(n)
        else:
            runs.append(cur); cur = [n]
    runs.append(cur)
    print(f'  in {len(runs)} runs, longest {max(len(r) for r in runs)} frames: '
          + ', '.join(f'{r[0]}-{r[-1]}' if len(r) > 1 else str(r[0]) for r in runs))
print('  ' + ' '.join(str(n) for n in bad))
