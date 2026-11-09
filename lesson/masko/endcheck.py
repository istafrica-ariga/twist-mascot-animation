#!/usr/bin/env python3
"""Check a one-shot ENDS on the pose the next loop starts from.

    python3 -I masko/endcheck.py clips/v5_yes_raw.mp4 aligned/pleased.png aligned/idle.png

`loopcheck.py` cannot judge these. It measures every frame against frame 0 and calls a clip a
CYCLE when it comes home, so a reaction that deliberately ends somewhere ELSE reports SNAP — and
that verdict is now meaningless, because landing away from home is the whole point.

What matters instead is whether the last frame matches the pose the destination loop begins on.
If it does the player can cut; if it drifts the cut shows. So: compare the final frame to the
TARGET pose, and to the START pose as a control. The target should win by a clear margin.
"""
import subprocess
import sys

clip, target = sys.argv[1], sys.argv[2]
control = sys.argv[3] if len(sys.argv) > 3 else None
N = 64
px = N * N


def frames(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={N}:{N}',
                          '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
                         capture_output=True).stdout
    return [raw[i * px:(i + 1) * px] for i in range(len(raw) // px)]


def mad(a, b):
    return sum(abs(a[i] - b[i]) for i in range(px)) / px


fr = frames(clip)
last, first = fr[-1], fr[0]
tgt = frames(target)[0]
print(f'{clip.split("/")[-1]}  {len(fr)} frames')
print(f'  last frame vs {target.split("/")[-1]:<14} {mad(last, tgt):6.2f}   <- should be LOW')
if control:
    ctl = frames(control)[0]
    print(f'  last frame vs {control.split("/")[-1]:<14} {mad(last, ctl):6.2f}   <- should be higher')
    print(f'  first frame vs {control.split("/")[-1]:<13} {mad(first, ctl):6.2f}   <- the clip starts here')
    verdict = 'LANDS ON TARGET' if mad(last, tgt) < mad(last, ctl) else 'DRIFTED'
    print(f'\n  {verdict}')
