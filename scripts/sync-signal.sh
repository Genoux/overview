#!/bin/sh
# Copy Signal's built CSS into the app and the prototype, as an app would after installing @barrymind/signal.
# Run after any change in ../signal (it rebuilds Signal first, then copies).
set -e
here="$(cd "$(dirname "$0")/.." && pwd)"
signal="$here/../signal"
[ -d "$signal" ] || { echo "Signal not found at $signal"; exit 1; }
node "$signal/scripts/build.mjs" >/dev/null
node "$signal/scripts/build.mjs" --check
for destination in app/web/vendor/signal prototype/vendor/signal; do
  mkdir -p "$here/$destination"
  cp "$signal/css/signal.css" "$signal/css/components.css" "$signal/css/extensions/overview.css" "$signal/package.json" "$here/$destination/"
  echo "Synced Signal $(grep '"version"' "$signal/package.json" | tr -d ' ",' | cut -d: -f2) into $destination"
done
