#!/usr/bin/env bash
# Usage: bun run wt:rm <dirname>
# Accepts folder name (feat-login) or full path
# Resilient: always attempts cleanup regardless of worktree state

set -uo pipefail

DIRNAME="${1:?Usage: bun run wt:rm <dirname>}"

# If it's just a folder name, prepend the worktree root
if [[ "$DIRNAME" != /* && "$DIRNAME" != ./* ]]; then
  WT_PATH="worktrees/$DIRNAME"
else
  WT_PATH="$DIRNAME"
fi

echo "Cleaning up worktree: $WT_PATH"

# Attempt git worktree removal (may fail if already removed or inconsistent)
if git worktree remove "$WT_PATH" 2>/dev/null; then
  echo "  ✓ Git worktree removed"
else
  echo "  - Git worktree not found or already removed"
fi

# Prune stale worktree records
git worktree prune
echo "  ✓ Stale worktrees pruned"

# Always attempt directory removal to prevent orphans
if [ -d "$WT_PATH" ]; then
  rm -rf "$WT_PATH"
  echo "  ✓ Directory removed: $WT_PATH"
else
  echo "  - Directory already gone: $WT_PATH"
fi

echo "Cleanup complete"
