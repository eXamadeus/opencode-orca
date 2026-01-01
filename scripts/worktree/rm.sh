#!/usr/bin/env bash
# Usage: bun run wt:rm <dirname>
# Accepts folder name (feat-login) or full path

set -euo pipefail

DIRNAME="${1:?Usage: bun run wt:rm <dirname>}"

# If it's just a folder name, prepend the worktree root
if [[ "$DIRNAME" != /* && "$DIRNAME" != ./* ]]; then
  WT_PATH="worktrees/$DIRNAME"
else
  WT_PATH="$DIRNAME"
fi

if [ ! -d "$WT_PATH" ]; then
  echo "Error: Worktree not found at $WT_PATH"
  exit 1
fi

echo "Removing worktree: $WT_PATH"
git worktree remove "$WT_PATH"
git worktree prune

echo "Worktree removed and pruned"
