#!/usr/bin/env python3
"""Replace the frames where the teeth fused with the nearest frame where they did not.

    python3 -I masko/mouthfix.py clips/v7_narrate_raw.mp4 clips/v7_narrate_fixed.mp4

Two generations could not stop the model fusing the two teeth into one white band on about one
frame in six, so this fixes it after the fact instead of paying for a third roll. `mouthcheck.py`
finds the bad frames; each is swapped for the NEAREST good one, before or after, whichever is
closer.

That is frame substitution, and it is the same move the Eddy Interactions file makes for its smear
frames: swap the artwork for a few frames and nobody sees the swap. Here the runs are 1 to 4 frames
long, so the longest hold is about a sixth of a second in a mouth that is moving anyway.

Cheaper than a re-roll and, unlike a re-roll, certain.
"""
import os
import subprocess
import sys

src, out = sys.argv[1], sys.argv[2]
THRESH = float(sys.argv[3]) if len(sys.argv) > 3 else 0.42
W = 160

rate = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                       'stream=r_frame_rate', '-of', 'csv=p=0', src],
                      capture_output=True, text=True).stdout.strip()
fps = eval(rate)

raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vf',
                      f'crop=in_w*0.34:in_h*0.14:in_w*0.33:in_h*0.42,scale={W}:{W}',
                      '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
step = W * W * 3
probe = [raw[i * step:(i + 1) * step] for i in range(len(raw) // step)]

bad = set()
for n, f in enumerate(probe):
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
    if widest / W > THRESH:
        bad.add(n)

total = len(probe)
good = [n for n in range(total) if n not in bad]
if not good:
    sys.exit(f'{src}: every frame is bad, nothing to substitute from')

# for each bad frame, the nearest good one
sub = {}
for n in sorted(bad):
    sub[n] = min(good, key=lambda g: (abs(g - n), g))

tmp = os.path.join(os.path.dirname(out) or '.', '_mf')
os.makedirs(tmp, exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, f'{tmp}/f%04d.png'], check=True)
for n, g in sub.items():
    subprocess.run(['cp', f'{tmp}/f{g + 1:04d}.png', f'{tmp}/f{n + 1:04d}.png'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', f'{tmp}/f%04d.png',
                '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', out], check=True)
subprocess.run(['rm', '-rf', tmp])

print(f'{os.path.basename(src)}  {total} frames')
print(f'  replaced {len(sub)} fused-teeth frames ({len(sub) / total * 100:.0f}%)')
print('  ' + ', '.join(f'{n}<-{g}' for n, g in sorted(sub.items())))
print(f'  -> {os.path.basename(out)}')
