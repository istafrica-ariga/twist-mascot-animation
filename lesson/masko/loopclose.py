#!/usr/bin/env python3
"""Close a generated loop so the motion carries through the join.

    python3 -I masko/loopclose.py clips/idle_v2_raw.mp4 clips/idle_closed.mp4

Pinning the same pose as `startFrame` and `endFrame` makes the clip END where it BEGAN, which is
necessary but not sufficient. The model eases into the end frame and out of the start frame, so
the velocity goes to zero at both ends: the first idle sat under a tenth of its median step for
its last 8 frames and crawled for its first 3. Played on repeat that is a third of a second of
stillness straddling the join, and it reads as the animation stopping — which is exactly what it
is doing.

Position continuity is not enough. The join needs velocity continuity too.

So: drop the stalled frames at both ends, then dissolve what is left of the tail over the head.

Writing the kept frames as source[a .. b] of length M, and choosing an overlap of K frames, the
output is L = M - K frames long and

    out[i] = source[a + i]                                     for i >= K
    out[i] = lerp(source[a + L + i], source[a + i], i / K)     for i <  K

The second line is the whole trick. out[L-1] is source[a + L - 1], and out[0] starts out as
source[a + L] — the very next frame of the original. So the join is not a cut between two distant
moments, it is two consecutive frames, and the motion runs straight through it. The dissolve then
carries the picture back to the head over K frames, and because both ends sit near the same home
pose there is little to blend away.

Done on the green master, before keying, so the dissolve mixes background with background and
keys out identically.
"""
import os
import subprocess
import sys

src = sys.argv[1]
out = sys.argv[2]
OVERLAP = int(sys.argv[3]) if len(sys.argv) > 3 else 8
N = 64
px = N * N

rate = subprocess.run(
    ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate',
     '-of', 'csv=p=0', src], capture_output=True, text=True).stdout.strip()
fps = eval(rate)

raw = subprocess.run(
    ['ffmpeg', '-v', 'error', '-i', src, '-vf', f'scale={N}:{N}',
     '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
fr = [raw[i * px:(i + 1) * px] for i in range(len(raw) // px)]


def mad(p, q):
    return sum(abs(p[i] - q[i]) for i in range(px)) / px


steps = [0.0] + [mad(fr[i], fr[i - 1]) for i in range(1, len(fr))]
peak = max(steps)
median = sorted(steps[1:])[len(steps) // 2]

# A frame counts as "moving properly" above this. Scaling it off the PEAK alone breaks on a clip
# that contains one big gesture: the fourth idle peaks at 5.38 against a median of 0.45, so
# peak * 0.30 came to 1.61 — three and a half times the clip's ordinary motion. Everything except
# the gestures was declared dead, the trim cut to 7..105, and the join landed inside a head turn,
# which both ghosted (8.26) and jumped (5.4x median).
#
# So take whichever is lower. On a clip whose motion is evenly spread the peak-based figure still
# rules; on one with a loud moment the median-based figure keeps the threshold near the clip's own
# ordinary pace, and only the genuinely stalled ends get cut.
LIVE = min(peak * 0.30, median * 0.6)

# KEEP THE HEAD. Walking in from the start was wrong, and it is the single thing that made the
# fourth set unloopable at first: the eased-in opening frames ARE the home pose, and the home pose
# is exactly what the tail has to be blended against. Trim them and frame `a` becomes the start of
# a gesture, so the dissolve mixes a head turn with a settled stand. Measured on the fourth idle:
#
#     a      ghosting
#     0      0.88 - 1.86
#     7      7.27 - 8.46
#
# Nearly an order of magnitude, on the same clip, from that one choice. Only the tail is dead
# weight, because by then the motion has already returned home and is just sitting there.
a = 0
LIVE = min(peak * 0.30, median * 0.6)

# Now search the trim end AND the overlap together. Two conditions, in priority order:
#
#   the join must MOVE          - out[0] continues from source[a+L], and if that frame is dozing
#                                 the loop reads as a hesitation however well the pixels line up.
#   the dissolve must not SMEAR - it blends source[a..a+K] against source[a+L..b], and those are
#                                 only alike while both sit near the home pose.
#
# Chasing the best ratio of the two picks a join that moves hard and smears hard with it (narrate's
# best ratio ghosted at 4.98). So: require the join to clear 60% of the clip's median step, and
# among everything that clears it take the LEAST ghosting. Nothing qualifying falls back to the
# ratio, which is better than refusing to cut at all.
# Score the WRAP directly. The old score used "is the join frame moving?" as a proxy for "will the
# loop read as a hesitation", with a floor that a candidate had to clear. On a clip whose prop moves
# that floor rejects the right answer: the best wrap sits near the end where the motion has calmed,
# fails the liveliness test, and the search settles on a candidate that wraps at 3.2x the median
# instead of 0.7x.
#
# But the wrap step is not a proxy for the jump. It IS the jump — the distance from the last output
# frame back to the first. So measure that, add the ghosting it costs, and minimise the pair.
best = None
for cand in range(len(fr) - 1, a + OVERLAP * 3, -1):
    for K_c in (4, 6, 8, 12):
        L_c = cand - a + 1 - K_c
        if L_c < K_c * 3:
            continue
        ghost = sum(mad(fr[a + i], fr[a + L_c + i]) for i in range(K_c)) / K_c
        wrap = mad(fr[a], fr[a + L_c - 1])
        score = wrap / max(median, 0.01) + ghost * 0.35
        if best is None or score < best[0]:
            best = (score, cand, K_c)
b, OVERLAP = best[1], best[2]

M = b - a + 1
K = min(OVERLAP, M // 4)
L = M - K
if L < 2:
    sys.exit(f'{src}: not enough moving frames to close a loop ({M} kept)')

# out[i<K] = lerp(tail[i], head[i], i/K): the tail enters fully opaque and fades away over K
# frames, so frame 0 of the output continues straight on from the last frame of the output.
fade = K / fps
fc = (
    f'[0:v]trim=start_frame={a}:end_frame={a + L},setpts=PTS-STARTPTS[head];'
    f'[0:v]trim=start_frame={a + L}:end_frame={a + M},setpts=PTS-STARTPTS,'
    f'format=yuva420p,fade=t=out:st=0:d={fade:.4f}:alpha=1[tail];'
    f'[head][tail]overlay=0:0:eof_action=pass,format=yuv420p[v]'
)

subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-filter_complex', fc,
                '-map', '[v]', '-r', str(fps), '-c:v', 'libx264', '-crf', '16',
                '-pix_fmt', 'yuv420p', out], check=True)

ghost_at = sum(mad(fr[a + i], fr[a + L + i]) for i in range(K)) / K
print(f'{os.path.basename(src)}  {len(fr)} frames')
print(f'  trimmed to {a}..{b}   ({M} frames moving above {LIVE:.2f})')
print(f'  dissolved {K}-frame tail over the head   (ghosting {ghost_at:.2f})')
print(f'  -> {os.path.basename(out)}  {L} frames = {L / fps:.2f}s')

# The test that matters: step across the WRAP, last frame back to first. On the input this is
# meaningless because both ends are stalled; on a properly closed loop it should sit in the same
# range as an ordinary step.
raw2 = subprocess.run(
    ['ffmpeg', '-v', 'error', '-i', out, '-vf', f'scale={N}:{N}',
     '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
g = [raw2[i * px:(i + 1) * px] for i in range(len(raw2) // px)]
gs = [mad(g[i], g[i - 1]) for i in range(1, len(g))]
wrap = mad(g[0], g[-1])
med = sorted(gs)[len(gs) // 2]
print(f'\n  median step        {med:.2f}')
print(f'  step across join   {wrap:.2f}  ({wrap / max(med, 0.001):.1f}x median)')
print('  ' + ('CONTINUOUS' if wrap < med * 2.5 else 'STILL JUMPS'))
