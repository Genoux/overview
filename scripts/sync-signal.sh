#!/bin/sh
# Copy Signal's built CSS into the prototype, as an app would after installing @barrymind/signal.
# Run after any change in ../signal (it rebuilds Signal first, then copies).
set -e
here="$(cd "$(dirname "$0")/.." && pwd)"
signal="$here/../signal"
[ -d "$signal" ] || { echo "Signal not found at $signal"; exit 1; }
node "$signal/scripts/build.mjs" >/dev/null
node "$signal/scripts/build.mjs" --check
mkdir -p "$here/prototype/vendor/signal"
cp "$signal/css/signal.css" "$signal/css/extensions/overview.css" "$signal/package.json" "$here/prototype/vendor/signal/"
echo "Synced Signal $(grep '"version"' "$signal/package.json" | tr -d ' ",' | cut -d: -f2) into prototype/vendor/signal"
