#!/bin/sh
# Renders review stills and a contact sheet from a fresh bundle. Usage: sh scripts/stills.sh <sheet-name> <frame> [<frame> ...]
set -e
name=$1; shift
mkdir -p stills
npx remotion bundle src/index.ts --out-dir=build --log=error >/dev/null
list=""
for f in "$@"; do
  npx remotion still build Trailer "stills/f$f.jpg" --frame="$f" --scale=0.5 --gl=angle --image-format=jpeg --log=error >/dev/null
  list="$list -i stills/f$f.jpg"
done
n=$#
cols=3
rows=$(( (n + cols - 1) / cols ))
ffmpeg -y -v error $list -filter_complex "$(i=0; for f in "$@"; do printf "[%d:v]" $i; i=$((i+1)); done)xstack=inputs=$n:grid=${cols}x${rows}:fill=black,scale=1920:-1" -frames:v 1 "stills/$name.jpg"
echo "stills/$name.jpg"
