---
name: audit-docs
description: "Audit all Claude Code documentation for staleness, broken references, and redundancy. Run periodically to keep docs healthy."
disable-model-invocation: true
allowed-tools: Read, Grep, Glob
---

# Audit Documentation Freshness

You are a documentation auditor. Your job is to check all Claude Code docs for staleness, broken references, and redundancy, then produce an actionable report.

## Process

### 1. Inventory All Docs

Read every file in these locations:
- `.claude/docs/*.md` — Project domain knowledge
- `.claude/CLAUDE.md` — Main project instructions
- `.claude/CLAUDE.local.md` — Local project context
- `~/.claude/rules/*.md` — Global coding rules
- Auto memory directory `memory/*.md` — Cross-session learnings

For each file, record: filename, line count, `alwaysApply` value, `Last updated` date (if present).

### 2. Check for Staleness

For each doc:
- **Date check**: Is `Last updated` older than 30 days? Flag as potentially stale.
- **Reference check**: Use Glob/Grep to verify that file paths, function names, and type names mentioned in the doc still exist in the codebase.
- **Frontmatter check**: Do glob patterns in frontmatter match actual project structure?

### 3. Check for Redundancy

- Are any docs duplicating the same information?
- Are any docs stating things Claude already knows (standard TS patterns, obvious conventions)?
- Are any rules contradicting each other across different files?

### 4. Check Context Budget

Calculate total always-loaded lines:
- All files with `alwaysApply: true`
- All `~/.claude/rules/*.md` files (always loaded)
- `CLAUDE.md` and `CLAUDE.local.md` (always loaded)
- `memory/MEMORY.md` (always loaded, first 200 lines)

**Target**: < 500 lines always-loaded. Flag if exceeded.

### 5. Output Report

```markdown
## Documentation Audit Report

**Date**: YYYY-MM-DD
**Total docs audited**: N
**Always-loaded lines**: N (target: <500)

### Fresh (no issues)
- file.md (N lines, updated YYYY-MM-DD)

### Potentially Stale
- file.md — Last updated >30 days ago / no date found
- file.md — References `path/to/deleted/file.ts` which no longer exists

### Redundant
- file1.md and file2.md both document X

### Recommendations
1. [Specific action: delete, merge, update, or trim]
2. ...
```

## Rules

- Be specific: "line 42 references `src/old/path.ts` which doesn't exist" not "some references may be outdated"
- Don't suggest adding docs — this audit is about pruning and freshening
- If a doc has no issues, say so briefly and move on
- Focus on actionable findings, not style nitpicks
