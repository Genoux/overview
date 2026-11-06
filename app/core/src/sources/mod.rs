//! One reader per agent. Each lists its session files and reads one file into a normalized `Session`.
//! To support another agent (Gemini CLI, OpenCode, Kimi, ...), add a module with the same two functions and list it here.
pub mod claude;
pub mod codex;
