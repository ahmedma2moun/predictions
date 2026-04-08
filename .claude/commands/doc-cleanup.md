---
description: "Audit and clean up project documentation — remove stale files, consolidate scattered docs, maintain doc hygiene"
allowed-tools: ["Bash", "Read", "Write"]
---
# Documentation Cleanup

Audit all documentation in this project and clean up stale/orphan files.

## Scope
Target: $ARGUMENTS (default: all `docs/`, and root `.md` files)

## Procedure
1. **Inventory**: List all `.md` files with last-modified date, size, and a 1-line summary
2. **Classify**: Mark each as Active (referenced, maintained), Stale (outdated but useful), or Orphan (one-off, superseded)
3. **Consolidate**: Merge useful stale content into `docs/architecture/` documents
4. **Archive/Delete**: Move orphans to `docs/.archive/` or delete. ASK before deleting
5. **Verify links**: Check all remaining docs for broken internal references
6. **Report**: Show cleanup summary with files kept/consolidated/removed and size savings

## Orphan Detection Patterns
- `*_SUMMARY.md`, `*_REVIEW.md`, `*_STATUS.md` describing completed work
- Multiple versions of same doc (keep latest only)
- AI-generated implementation logs
- Resolved bug/feature notes

## Safety: Never auto-delete README.md, CHANGELOG.md, CONTRIBUTING.md, LICENSE, AGENTS.md, CLAUDE.md, or docs/architecture/*
