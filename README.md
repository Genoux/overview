# Overview

A read-only monitor of every coding-agent session on your machines (Claude
Code, Codex, SSH hosts): a ranked list of what needs you, what is running and
what finished, plus a small task tracker. Desktop app (Tauri), for macOS and Linux.

## Install (Linux)

Download the `.deb` or `.AppImage` from the repo's Releases page (alpha
builds are marked pre-release), then:

```sh
sudo apt install ./Overview_*_amd64.deb      # Debian, Ubuntu
# or
chmod +x Overview_*.AppImage && ./Overview_*.AppImage
```

## Run from source

```sh
# Linux needs the webview and GTK libraries once:
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libssl-dev
app/run.sh        # debug build; the first run compiles for a minute or two
cargo run -p overview-core --bin overview-probe -- --summary   # session counts in the terminal
```

## Check

```sh
scripts/check     # fmt, clippy -D warnings, tests
scripts/build     # release packages into dist/ (.deb + .AppImage on Linux, zipped .app on macOS)
```

## Release

Tag-driven (jb-toolkit `RULES.md` R4): `jb bump X.Y.Z` on a branch, merge,
`jb tag` on main, push the tag. The Release workflow builds the Linux packages
and drafts a GitHub release.
