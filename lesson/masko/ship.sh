#!/bin/bash
# Re-encode the 768 masters down to what the app actually shows, in both formats.
#
#   masko/ship.sh 256
#
# The mascot renders at 69 x 75 px on the lesson screen, so 256 covers a 3x retina phone with room
# to spare. At that size the whole set is about an eighth of what the 768 masters weigh and nothing
# is visible on screen.
#
# One rule worth not rediscovering: `scale` DROPS THE ALPHA unless `format=yuva420p` follows it.
# The file still encodes, still plays, and is simply opaque — and because ffprobe reports
# `pix_fmt=yuv420p` for VP9-with-alpha either way, the pixel format will not tell you. The thing to
# check is the `alpha_mode` stream tag, which this prints for every file it writes.
set -euo pipefail
PX=${1:-256}
SRC=clips
OUT=web
mkdir -p "$OUT"

for s in idle narrate pleased sheepish yes oops; do
  # VP9 for Chrome, Edge, Firefox, Android
  ffmpeg -v error -y -i "$SRC/$s.mov" -vf "scale=$PX:$PX,format=yuva420p" \
    -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 36 -row-mt 1 -speed 2 -an "$OUT/$s.webm" &
done
wait

for s in idle narrate pleased sheepish yes oops; do
  # HEVC for Safari, iOS, macOS. -alpha_quality is what keeps the matte from banding at the edges.
  ffmpeg -v error -y -i "$SRC/$s.mov" -vf "scale=$PX:$PX,format=yuva420p" \
    -c:v hevc_videotoolbox -alpha_quality 0.75 -q:v 55 -tag:v hvc1 -pix_fmt yuva420p -an \
    "$OUT/$s.mov"
done

printf "\n%-10s %9s %9s %9s\n" clip webm hevc alpha
tw=0; th=0
for s in idle narrate pleased sheepish yes oops; do
  w=$(stat -f%z "$OUT/$s.webm"); h=$(stat -f%z "$OUT/$s.mov")
  tw=$((tw+w)); th=$((th+h))
  a=$(ffprobe -v error -show_entries stream_tags=alpha_mode -of csv=p=0 "$OUT/$s.webm" | tr -d '\r')
  printf "%-10s %8dK %8dK %9s\n" "$s" $((w/1024)) $((h/1024)) "${a:-?}"
done
printf "%-10s %8dK %8dK   at %s px\n" TOTAL $((tw/1024)) $((th/1024)) "$PX"
