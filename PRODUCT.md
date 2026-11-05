# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(The product ships as a desktop app for macOS and Linux; its UI is a web view, so the design language is web, not native macOS or GNOME.)

## Stack

Delegated: Tauri 2 (Rust core for file watching, the Orca CLI and the SSH probe; web UI) with PixiJS for the isometric world. Chosen for a small footprint on macOS and Linux. Fallback is Electron if WebKitGTK on Wayland causes trouble. Prototypes are single static HTML files.

## Users

One user: the owner, a developer who runs many coding agents at once (Claude Code, Codex, Gemini, Cursor) across several projects and machines (a MacBook, an Arch Linux workstation, an Ubuntu home server), mostly inside Orca, an agentic IDE. They are highly visual and want to see a design before it is built.

The job: know at any moment what is running, what is done and what needs them, without opening each Orca tab or asking an agent for a summary. Also: end the day knowing what is left, and start the next morning knowing where to begin.

## Product Purpose

Overview is a read-only monitor of every agent session the user runs. It draws them as a small isometric pixel world they can pan around: each project is its own station or office, and each agent session is a creature working in it. An LLM summarises each session into a ranked to-do list and writes an end-of-day digest and a morning brief.

Success: the user opens Overview instead of asking agents "where are we at?", and acts on its "needs you" list first.

## Positioning

Overview reads the session state that already exists on disk (Orca's agent-hook status file, Claude Code and Codex transcripts, the same files on SSH hosts). Agents need no plugin and the user changes no habits. It watches; it never runs or types into agents in v1.

It is a separate app from Hangar (the owner's planned Arch-only agent runner, `~/Desktop/@john/hangar-roadmap`), confirmed 2026-11-05. It reuses Hangar's design language, and Hangar may absorb it later.

## Operating Context

- Used as a full window the user visits during the day: open it, pan and zoom across projects, then go back to Orca to act (confirmed 2026-11-05).
- Clicking a session jumps to its pane in Orca.
- Data sources, in order: Orca on the MacBook; SSH hosts (Arch workstation, home server); cloud sessions later.
- Orca exposes `~/Library/Application Support/orca/agent-hooks/last-status.json` (per pane: agent, state `working` / `waiting` / `done`, hook event, last prompt, last message, transcript path) and the `orca` CLI (`worktree ps --json`, `tab list`, `search`).

## Capabilities and Constraints

- Session states: working, needs you (waiting on a permission or a question), done, failed, asleep (no activity for a day or more).
- Read-only in v1: no approving, replying or typing into agents.
- LLM summaries are rewritten only when a session changes state; secrets are redacted before anything leaves the machine.
- Undecided: whether transcript excerpts may go to the Claude API (versus a local model); the final product name ("Overview" is a working name).

## Brand Commitments

- Working name: Overview.
- The owner likes Hangar's "Signal" look (monochrome, quiet, not AI-generated looking) and explicitly rejected the first prototype as "vibe coded". The world is an isometric pixel world, not a side-view cross-section (owner's request, 2026-11-05).

## Evidence on Hand

- Real project names on this Mac: gramly, overview, culture, jb-site, flow, hangar-roadmap, monotub, live-cam, wrap-up-your-day, ugc-hub.
- Hangar design inputs: `~/Desktop/@john/hangar-roadmap/inputs/tokens.json`, `ui/UI.md`, `ui/mockups-png/`, `inputs/floor/blobs.js`.
- No real session summaries exist yet; prototypes use sample data and must say so.

## Product Principles

1. Attention first: whatever needs the user is findable in under two seconds, in the world and in the list.
2. The world is the map, the list is the truth: every creature has a matching text row.
3. Watch, don't touch: never act on an agent's behalf in v1.
4. Local first: no account, no cloud backend; only redacted summaries leave the machine.
5. Calm by default: motion and colour are spent on state changes, not decoration.
