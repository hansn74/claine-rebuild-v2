# .ignore Folder

This folder contains files that should not be loaded into AI agent context by default.

## Contents

### original-docs/
Original large documentation files before sharding. These are kept as:
- **Reference**: Original source files for historical reference
- **Backup**: Safety backup before sharding process
- **Regeneration**: Source for re-sharding if needed

**Files:**
- `epics.md` (82K) - Original epic breakdown (now sharded in `/docs/epics/`)
- `technical-decisions.md` (79K) - Original ADRs (now sharded in `/docs/technical-decisions/`)

## Why These Files Are Here

These files were moved here after being sharded into smaller, more manageable files optimized for AI agent context loading. The sharded versions provide:
- **85-94% context savings** when loading documentation
- **Faster agent responses** due to reduced token usage
- **More precise context** by loading only relevant sections

## Usage

**For AI Agents:** Do NOT load files from this folder. Use the sharded versions in `/docs/epics/` and `/docs/technical-decisions/` instead.

**For Humans:** You can reference these files if you need to see the complete, original documentation in one place.

**For Re-sharding:** If you need to update and re-shard:
1. Edit the original file here
2. Run `md-tree explode [source] [destination]` to re-shard
3. Verify sharded output

---

_Last updated: 2025-11-03_
