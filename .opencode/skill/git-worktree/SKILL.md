---
name: git-worktree
description: Git worktree workflow helpers for parallel development on multiple branches
---

# Git Worktree Workflow

Worktrees enable working on multiple branches simultaneously without stashing or switching.

## Branch Naming Convention

Use semantic prefixes based on the type of work:

| Prefix     | Use When                                          | Example                  |
| ---------- | ------------------------------------------------- | ------------------------ |
| `feat/`    | New functionality, enhancements, additions        | `feat/user-auth`         |
| `fix/`     | Bug fixes, corrections, repairs                   | `fix/login-redirect`     |
| `chore/`   | Maintenance, dependencies, config updates         | `chore/update-deps`      |
| `refactor/`| Code restructuring without behavior change        | `refactor/api-handlers`  |
| `docs/`    | Documentation only                                | `docs/api-reference`     |
| `test/`    | Adding or updating tests                          | `test/auth-coverage`     |
| `ci/`      | CI/CD pipeline changes                            | `ci/github-actions`      |
| `style/`   | Formatting, whitespace (no code change)           | `style/lint-fixes`       |
| `perf/`    | Performance improvements                          | `perf/query-optimization`|

## Layout

```
opencode-orca/
├── worktrees/                  # Worktree container (gitignored)
│   ├── feat-login/             # Branch: feat/login
│   └── fix-build/              # Branch: fix/build
├── src/
└── ...
```

## Commands

| Command                          | Description                        |
| -------------------------------- | ---------------------------------- |
| `bun run wt:new <branch> [base]` | Create worktree (auto bun install) |
| `bun run wt:list`                | List all worktrees                 |
| `bun run wt:rm <dirname>`        | Remove worktree and prune          |

## Examples

```bash
# Create new feature branch from main
bun run wt:new feat/auth

# Create hotfix from production tag
bun run wt:new hotfix/urgent v1.2.0

# Attach to existing branch
bun run wt:new existing-branch

# List worktrees
bun run wt:list

# Remove worktree (by folder name)
bun run wt:rm feat-auth
```

## Updating a Worktree from Main

When `main` has new commits you want in your feature branch:

```bash
cd worktrees/feat-login

# Fetch latest
git fetch origin

# Merge
git merge origin/main
```

Or from anywhere using `-C`:

```bash
git -C worktrees/feat-login fetch origin
git -C worktrees/feat-login merge origin/main
```

## Notes

- Branch names are sanitized: `feat/login` → `feat-login` folder
- Dependencies are installed automatically on creation
- Each worktree is independent — no shared node_modules with the main repo
