#!/usr/bin/env bash
# Usage: bun run wt:new <branch> [base]
# Creates worktree at worktrees/<sanitized-branch>

set -euo pipefail

BRANCH="${1:?Usage: bun run wt:new <branch> [base]}"
BASE="${2:-main}"

# Sanitize branch name for folder (feat/login → feat-login)
FOLDER_NAME="${BRANCH//\//-}"

# Worktree root directory (inside repo, gitignored)
WT_ROOT="worktrees"
WT_PATH="$WT_ROOT/$FOLDER_NAME"

# Create worktree root if needed
mkdir -p "$WT_ROOT"

# Check if branch exists locally or remotely
if git show-ref --verify --quiet "refs/heads/$BRANCH" 2>/dev/null; then
  echo "Attaching to existing branch: $BRANCH"
  git worktree add "$WT_PATH" "$BRANCH"
elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH" 2>/dev/null; then
  echo "Attaching to existing remote branch: $BRANCH"
  git worktree add "$WT_PATH" "$BRANCH"
else
  echo "Creating new branch: $BRANCH from $BASE"
  git worktree add -b "$BRANCH" "$WT_PATH" "$BASE"
fi

# Install dependencies
echo "Installing dependencies..."
(cd "$WT_PATH" && mise x -- bun install)

echo ""
echo "Worktree ready at: $WT_PATH"
echo "  cd $WT_PATH"
