#!/bin/sh
# Renders the images shown on the 3D device screens, at twice their layout size.
set -e
npx remotion bundle src/index.ts --out-dir=build --log=error >/dev/null
for pair in ScreenWide:screen-wide ScreenTall:screen-tall ScreenBrowser:screen-browser; do
  npx remotion still build "${pair%%:*}" "public/app/${pair##*:}.png" --scale=2 --log=error >/dev/null
done
ls -la public/app
