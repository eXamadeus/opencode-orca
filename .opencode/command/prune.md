---
description: Clean up merged worktrees and stale branches
---

## /prune Command

Clean up worktrees and branches that have been merged and deleted on remote.

---

## Step 1: Update main branch

```bash
git fetch --prune
git checkout main
git pull --ff-only
```

---

## Step 2: Find stale branches (remote tracking gone)

```bash
git branch -vv | grep ': gone]'
```

---

## Step 3: List current worktrees

```bash
git worktree list
```

---

## Instructions

Based on the output above:

1. **For each stale branch found in Step 2:**
   - Convert branch name to folder name (replace `/` with `-`)
   - If a worktree exists for it in `worktrees/`, run: `bun run wt:rm <folder>`

2. **Delete the stale branches:**
   - Run: `git branch -D <branch>` for each stale branch

3. **Check for orphaned worktrees:**
   - For any worktree in `worktrees/` (not the main repo) that doesn't have a corresponding branch, run: `bun run wt:rm <folder>`

4. **Report summary:**
   ```
   Switched to main and updated
   Removed N worktree(s): <list>
   Deleted N branch(es): <list>
   ```
   Or if nothing to clean: "No stale branches or orphaned worktrees found."
