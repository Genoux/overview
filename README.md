# Overview

A read-only monitor of every coding-agent session on your machines (Claude
Code, Codex, SSH hosts): a ranked list of what needs you, what is running and
what finished, plus a small task tracker. Desktop app (Tauri), for macOS and Linux.

## Install

Download the `.AppImage` from the repo's Releases page (alpha builds are
marked pre-release). It runs on any distro, on Wayland or X11:

```sh
chmod +x Overview_*.AppImage && ./Overview_*.AppImage
```

macOS: download the `.app.zip`, unzip, move `Overview.app` to Applications.
It is unsigned: the first time, right-click › Open.

## Run from source

```sh
# Linux needs, once: WebKitGTK 4.1 and OpenSSL dev packages from your distro (e.g. webkit2gtk-4.1 on Arch)
app/run.sh        # debug build; the first run compiles for a minute or two
cargo run -p overview-core --bin overview-probe -- --summary   # session counts in the terminal
```

## Check

```sh
scripts/check     # fmt, clippy -D warnings, tests
scripts/build     # release packages into dist/ (AppImage on Linux, zipped .app on macOS)
```

## Release

Tag-driven (jb-toolkit `RULES.md` R4): `jb bump X.Y.Z` on a branch, merge,
`jb tag` on main, push the tag. The Release workflow builds the macOS app and the
Linux AppImage and drafts a GitHub release.
