#!/usr/bin/env bash
# Regenerates the PWA icons in public/icons/ from public/berean-logo.png.
# The output is checked in; run this only when the logo changes.
# Needs ImageMagick 7 (`brew install imagemagick`).
set -euo pipefail

cd "$(dirname "$0")/.."

SRC=public/berean-logo.png
OUT=public/icons
# Matches the desktop shell's window background (electron/main.ts).
BACKGROUND="#14110d"

mkdir -p "$OUT"

# "any" icons keep the logo's transparent background.
magick "$SRC" -resize 192x192 -strip "$OUT/icon-192.png"
magick "$SRC" -resize 512x512 -strip "$OUT/icon-512.png"

# Maskable: opaque, logo inside the central safe zone (a circle of 80% of
# the width), since platforms crop these to their own shapes.
magick -size 512x512 "xc:$BACKGROUND" \( "$SRC" -resize 352x352 \) \
  -gravity center -composite -depth 8 -strip "$OUT/icon-maskable-512.png"

# iOS home screen: opaque (iOS fills transparency with black), and iOS
# rounds the corners itself.
magick -size 180x180 "xc:$BACKGROUND" \( "$SRC" -resize 148x148 \) \
  -gravity center -composite -depth 8 -strip "$OUT/apple-touch-icon.png"
