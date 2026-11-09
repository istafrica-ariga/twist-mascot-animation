#!/bin/bash
# Turn a generated clip on chroma green into a transparent HEVC clip the app can play.
#
#   masko/key.sh clips/idle_raw.mp4 clips/idle.mov 2.4
#
# The third argument trims the clip to its motion. The generator's minimum duration is 5 s but the
# performance is over well before that — measured at 2.0 s on the first clip — and the rest is a
# dead hold. Trimming is right where retiming would be wrong: the motion is already correctly
# paced, there is just extra nothing on the end.
#
# One rule worth not rediscovering: `-c:v copy` DESTROYS the alpha channel on these files. The
# copy produces something that decodes with "PPS id out of range" and renders 100% clear. Video
# and audio have to be re-encoded together, in one pass, which is what this does.
set -euo pipefail

SRC=${1:?usage: key.sh <raw.mp4> <out.mov> [seconds]}
OUT=${2:?usage: key.sh <raw.mp4> <out.mov> [seconds]}
DUR=${3:-}

# 0x08a84d, not the 0x09ae4f the poses are drawn on: the encoder shifts the green slightly, so the
# key is set to the colour that actually comes back rather than the one that went in.
KEY="colorkey=0x08a84d:0.26:0.09,despill=type=green:mix=0.5:expand=0"

ffmpeg -v error -y ${DUR:+-t "$DUR"} -i "$SRC" \
  -vf "$KEY" \
  -c:v hevc_videotoolbox -alpha_quality 0.75 -q:v 55 -tag:v hvc1 \
  -pix_fmt yuva420p -an "$OUT"

# Report how much of the frame actually survived keying. A clip that comes out ~100% clear means
# the key ate the character; ~0% clear means it missed the background entirely. Either way the
# number catches it here rather than on the device.
#
# One middle frame only. Scanning the whole clip counts every frame's pixels but there is just one
# frame's worth to divide by, which is how this first reported "8818% clear".
MID=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT")
CLEAR=$(ffmpeg -v error -ss "$(echo "$MID" | awk '{print $1/2}')" -i "$OUT" -frames:v 1 \
  -vf "alphaextract,scale=64:64" -f rawvideo -pix_fmt gray - \
  | od -An -tu1 -v | tr -s ' ' '\n' | grep -c '^0$' || true)
SIZE=$(( $(stat -f%z "$OUT") / 1024 ))
echo "$(basename "$OUT")  ${SIZE} KB  ${DUR:-full length}  $(( CLEAR * 100 / 4096 ))% clear"
