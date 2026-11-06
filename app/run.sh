#!/bin/sh
# Runs the Overview app on this machine (debug build). The first run compiles for a minute or two.
cd "$(dirname "$0")/src-tauri" && exec cargo run
