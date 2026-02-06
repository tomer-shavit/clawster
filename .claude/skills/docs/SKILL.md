---
name: docs
description: "Capture session learnings into persistent, auto-loading documentation. Use after debugging sessions, architectural decisions, or discovering gotchas. Invoke with /docs or /docs <topic>."
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Grep, Glob
argument-hint: "[topic]"
---

# Capture Session Learnings

You are a documentation distiller. Your job is to extract the **essence** of what was learned in this conversation and persist it so future sessions automatically benefit.

## Process

### 1. Identify Learnings

Review the full conversation and extract:
- **Gotchas**: Things that broke unexpectedly or worked differently than assumed
- **Patterns**: Recurring solutions or approaches that worked well
- **Decisions**: Architectural or design choices made and their rationale
- **Corrections**: Wrong assumptions that were discovered and corrected

If `$ARGUMENTS` is provided, focus on that topic. Otherwise, auto-detect all learnings.

### 2. Check for Existing Docs

Search for overlap before creating new files:

```
Locations to check:
- .claude/docs/*.md          — Project domain knowledge
- ~/.claude/rules/*.md        — Coding rules (user-level)
- memory/*.md                 — Cross-session learnings (auto memory dir)
```

Read existing docs that might overlap. Prefer **editing an existing doc** over creating a new one.

### 3. Decide Placement

| Type of Learning | Location | When |
|-----------------|----------|------|
| Hard-won gotchas, debugging patterns | `memory/<topic>.md` | Specific to this project, useful across sessions |
| Architectural decisions, domain knowledge | `.claude/docs/<topic>.md` | Affects how features should be built |
| New coding rules or conventions | `~/.claude/rules/<topic>.md` | Applies across all projects |

### 4. Write the Doc

**Format rules:**
- Start with YAML frontmatter (for `.claude/docs/` files):
  ```yaml
  ---
  description: "One-line description of what this doc covers and when it's relevant"
  globs: ["path/to/relevant/**/*.ts"]
  alwaysApply: false
  ---
  ```
- Include `Last updated: YYYY-MM-DD` after the title
- Be **concise** — distill to actionable rules, not narrative
- Use bullet points over paragraphs
- Include the "why" for each rule (so future sessions can prune if outdated)
- No code examples unless the exact syntax is non-obvious

**For memory files:**
- No frontmatter needed
- Include `Last updated: YYYY-MM-DD`
- After creating/editing, update `memory/MEMORY.md` index with a link to the topic file

### 5. Verify

After writing:
1. Confirm the file exists and is well-formed
2. If it's a `.claude/docs/` file, verify the glob patterns match actual project paths
3. If it's a memory file, verify `memory/MEMORY.md` has been updated
4. Report what was created/edited and where

## Anti-Patterns (DO NOT)

- Do NOT create docs for things Claude already knows (standard TS patterns, obvious conventions)
- Do NOT duplicate information that exists in code (types, schemas, interfaces)
- Do NOT write narrative — distill to actionable bullets
- Do NOT set `alwaysApply: true` — use targeted globs instead
- Do NOT create docs longer than 100 lines — split into multiple files if needed
