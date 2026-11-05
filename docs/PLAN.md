# Overview: Product Plan

As of 2026-11-05. Working name: "Overview".

## Vision

Overview is a read-only control room for every coding agent you run. It shows the work as a small isometric world: each machine is an island, each project a plot, and each agent session a generated creature that works at its desk and lives on the island when it is free. When one is blocked, it hops under a yellow diamond.

It answers three questions without opening a single tab:

1. **What is running right now?** Creatures at work, grouped by project.
2. **What needs me?** Raised hands, ranked by urgency, with a one-line "why".
3. **Where do I start tomorrow?** An end-of-day digest and a morning brief, written by an LLM from the real session logs.

**What it is:** a monitor plus an automatic to-do list across Orca, Claude Code, Codex and SSH machines. Think The Sims, where every Sim is a real agent session.

**What it is not (v1):** not an IDE, not a terminal, not a way to type into agents. Clicking a creature jumps to the session in Orca or the terminal where it lives.

**The core bet:** the data already exists on disk. Overview reads it, so agents need no plugin and you change no habits.

## What I found on this Mac (2026-11-05)

| Source | Where | What it gives us |
|---|---|---|
| Orca status hooks | `~/Library/Application Support/orca/agent-hooks/last-status.json` | Per pane: agent type, **state** (`working` / `waiting` / `done`), hook event (e.g. `PermissionRequest`), last prompt, last assistant message, transcript path, worktree and tab id. 20 panes tracked right now. |
| Orca CLI | `/Applications/Orca.app/Contents/Resources/bin/orca` | 249 commands: `worktree ps --json` (summary across worktrees, **with host**), `tab list`, `terminal list`, `search` (full text of agent sessions), `environment list` (remote Orca runtimes). |
| Orca hook scripts | `~/.orca/agent-hooks/{claude,codex,cursor,gemini}-hook.sh` | Orca already instruments Claude, Codex, Cursor and Gemini. |
| Claude Code transcripts | `~/.claude/projects/*/*.jsonl` | 26 project folders, including 5 `ssh-*` ones (remote sessions). |
| Codex transcripts | `~/.codex/sessions/2026/...` | Codex session JSONL. |
| Hangar plan | `~/Desktop/@john/hangar-roadmap` | Approved roadmap with a **Floor** creature scene (`inputs/floor/blobs.js`), needs-you panel, Overview table, Signal design tokens. |

Orca's states map one-to-one onto creature behaviour: `working` = typing, `waiting` = hand raised, `done` = resting. That makes v1 small.

## Open questions

The first question changes everything else. Hangar's approved roadmap already has a Floor with blob creatures, a needs-you panel and an Overview table. But Hangar is an agent *runner*: it spawns agents, makes worktrees and opens PRs. It targets Arch only and runs 29 to 36 weeks. Overview only *watches*, runs on macOS and Linux, and could ship a first build in weeks.

- [ ] **Hangar or Overview?** My recommendation: build Overview first as a separate observer on top of Orca. Hangar's Floor and inbox designs carry over, and Hangar can absorb Overview later.
- [ ] **Read-only in v1?** My recommendation: yes. A raised hand shows why, and one click jumps to that pane in Orca. Answering from Overview comes later.
- [ ] **LLM and privacy:** is it OK to send redacted transcript excerpts to the Claude API? The alternative is a local model, which is slower and gives weaker summaries.
- [ ] **Sources in order:** I propose Orca on this Mac, then the Arch workstation and home server over SSH, then cloud sessions (Codex cloud, Claude Code on the web). Is anything missing?
- [ ] **Where it lives on screen:** a full window, a second-monitor wall, or a small always-on-top pane plus a menu-bar count?
- [ ] **Creatures:** reuse Hangar's grey blobs, or give each agent type its own species (Claude, Codex, Gemini)?
- [ ] **Name:** "Overview" is a working name.

## Core pipeline

```
 SOURCES                  COLLECT (read-only)       CORE (local)                      UI
 Orca last-status.json ─┐
 orca worktree ps/tab ──┤                          ┌─> State engine ──────────┐
 ~/.claude/projects ────┼─> Collectors ─> Events ──┤   working/waiting/done/  ├─> Pixel world (creatures)
 ~/.codex/sessions ─────┤   (tail + parse)  SQLite │   failed/idle per session├─> Attention panel (ranked)
 SSH hosts (same probe)─┘                          └─> Summarizer (LLM) ──────┴─> Daily digest / morning brief
                                                       redact -> summarize on
                                                       state change, debounced
```

1. **Collectors** watch files and poll the Orca CLI. They never write to source files and never send keystrokes.
2. **Normalizer** turns every source into one event shape: `{host, project, session, agent, state, at, prompt?, lastMessage?, transcriptPath}`.
3. **Event store** is SQLite. It keeps the history behind "what happened today".
4. **State engine** decides each session's state and attention score: waiting on permission > waiting on question > failed > working > done > idle. It also groups sessions into projects by repo or worktree.
5. **Summarizer** runs only when a session changes state, debounced, never per token. Input is the tail of the transcript after redaction. Output is a strict JSON shape: one-line title, what was done, what is left, what it needs from you, priority.
6. **UI** renders the same state three ways: the pixel world, the attention panel, and the digest.

Remote hosts: the same binary runs on the remote machine in `probe` mode over SSH and streams events as JSON over stdout. No open ports, no daemon to install by hand. Orca's own remote environments already appear in `orca worktree ps` with `host=`, so many remote sessions come for free.

## Stack

| Layer | Choice | Why |
|---|---|---|
| App shell | **Tauri 2** (Rust core + web UI) | macOS + Linux from one codebase. Much lighter than Electron, which matters for an always-on monitor. Fallback: Electron, if WebKitGTK on Wayland gives trouble (Hangar's research already covers Electron on Wayland). |
| Collectors, SSH probe | Rust (`notify` file watching, `serde_json`, system `ssh` with ControlMaster) | One binary does local collection and the remote probe. Reusing your `~/.ssh/config` means no key handling of our own. |
| Store | SQLite (`rusqlite`), local only | Zero setup, easy to inspect. |
| UI | React + TypeScript + Vite | Panels, lists, digest. |
| Pixel world | **PixiJS 8** with nearest-neighbour scaling at integer zoom | Crisp pixels at any window size. Sprite sheets and animation states, smooth with 30+ creatures. |
| Art pipeline | Aseprite → sprite sheet JSON | Clean, hand-made pixel art. Hangar's `blobs.js` is the starting reference. |
| LLM | Claude API: Haiku 5.5 (`claude-haiku-5-5`) for per-session summaries, Sonnet 5.5 (`claude-sonnet-5-5`) for the daily digest | Fast and cheap for frequent small summaries, stronger model once a day. The key lives in the OS keychain. |
| Packaging | `.dmg` for macOS; AppImage + an AUR package for Arch | Covers both of your machines. |

## Security model

- **Read-only by design.** Collectors only read files and run read-only Orca commands. v1 has no code path that types into a terminal or approves a permission.
- **Secrets never leave the machine.** Before anything goes to the LLM, a redaction pass strips env-style secrets, API keys, tokens, private keys, `.env` contents and long base64. Orca's hook token and port in `endpoint.env` are never read into the app.
- **Minimum context to the LLM.** Only the transcript tail and the last messages, capped in size, with a per-project switch to never send.
- **SSH uses your own config and agent.** No keys are stored in Overview. The probe runs as your user and is read-only.
- **Local-first.** No cloud backend and no account. The SQLite file is created with `0600` permissions.
- **API key in the OS keychain** (macOS Keychain, Secret Service on Linux), never in a dotfile.

## Visual direction

v3 is the current direction. Its rules live in `DESIGN.md` and its colours and components in the shared Signal design system (`../signal`), so this plan does not repeat them:
- monochrome graphite, with colour only for status and for "you";
- an isometric metric grid with terrain islands, plots, a commons and bridges;
- creatures generated from each session and running their own life simulation;
- an attention rail with a track-only task tracker.

## Screens & components

Everything is local; run `./serve.sh` and open the hub.

| Screen | File | Status |
|---|---|---|
| Map v3 (current) | `prototype/overview-map.html` | Islands, creature life, tracker, interactive status bar, on Signal |
| Map v2 | `prototype/map.html` | First isometric grid; history |
| World v1 | `prototype/world.html` | Side-view office, rejected; history |
| Signal reference | `../signal/index.html`, `../signal/docs/reference/` | Shared design system |

Next screens: session detail drawer, sources settings (add an SSH host), menu-bar mini view.

## Roadmap

| Phase | Goal | Done when |
|---|---|---|
| P0 Prototype | Visual direction approved | You approve the world + panel look |
| P1 Local read | Real Orca + Claude + Codex data on this Mac, no LLM | Creatures match the real Orca states live |
| P2 Summaries | LLM summaries + attention ranking | The panel reads like a to-do list you trust |
| P3 Remote | SSH probe for the Arch workstation and home server | Sessions from 3 machines in one world |
| P4 Digest | End-of-day digest + morning brief | You start your day from Overview, not from asking agents |
| P5 Linux | Arch package, Wayland polish | Daily use on both machines |
| Later | Act from Overview (approve, reply), cloud sessions | Decided after P4 |
