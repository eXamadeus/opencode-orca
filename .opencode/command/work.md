---
description: Pick up an issue and set up development environment
---

## /work Command

Pick up a GitHub issue and set up a development environment for it.

### Input
- Description (optional): $ARGUMENTS

---

## Phase 1: Issue Selection (via @product-manager agent)

**If description provided ("$ARGUMENTS" is not empty):**
1. Search assigned issues for one matching: "$ARGUMENTS"
2. If no match → tell user and STOP

**If no description provided:**
1. Query project board for issues assigned to @me with status "Todo" or "In Progress"
2. Group by parent epic (if any)
3. Apply picker logic:
   - **Multiple epics with issues** → list epics, ask user to pick
   - **Multiple issues in epic** → list issues, ask user to pick
   - **One issue total** → use it (no prompt)
   - **Zero issues** → say "No assigned issues found" and STOP

---

## Phase 2: Extract Issue Data

From the selected issue, extract:
- `ISSUE_NUMBER`: The issue number (e.g., `42`)
- `ISSUE_TITLE`: The issue title
- `ISSUE_LABELS`: The labels on the issue
- `ISSUE_ASSIGNEES`: Current assignees on the issue

---

## Phase 3: Update Issue Status and Assignment

### Set Status to "In Progress"

Delegate to `github` agent:

```
Update project item status for issue #<ISSUE_NUMBER>:
- Project number: 2
- Owner: @me
- New status: "In Progress" (option ID: 47fc9ee4)
```

### Assign to Current User (if not already assigned)

Check if current user is already assigned:
```bash
gh api user --jq '.login'
```

If current user's login is NOT in ISSUE_ASSIGNEES:

Delegate to `github` agent:
```
Add @me as assignee to issue #<ISSUE_NUMBER>
```

---

## Phase 4: Compute Branch Components

**TAG** — Map first matching label to tag:
| Label   | Tag   |
| ------- | ----- |
| `feature` | `feat`  |
| `bug`     | `fix`   |
| `enhancement` | `enhancement` |
| (none)  | `feat`  |

**SLUG** — Convert issue title to kebab-case:
- Lowercase
- Replace spaces/special chars with hyphens
- Max 4-5 words
- Example: "Add user profile settings" → `add-user-profile-settings`

**Computed values:**
- `BRANCH`: `<TAG>/<ISSUE_NUMBER>/<SLUG>`
- `FOLDER`: `<TAG>-<ISSUE_NUMBER>-<SLUG>`

---

## Phase 5: Execute Commands

Run these exact commands in sequence:

```bash
# 1. Create worktree with branch
bun run wt:new <BRANCH>

# 2. Launch IDE in worktree directory
idea worktrees/<FOLDER>/
```

**Example** for issue #42 "Add user profile settings" with `feature` label:
```bash
bun run wt:new feat/42/add-user-profile-settings
idea worktrees/feat-42-add-user-profile-settings/
```

---

## Phase 6: Report

Output to user:
```
✓ Issue: #<ISSUE_NUMBER> — <ISSUE_TITLE>
✓ Status: In Progress
✓ Assigned: @me
✓ Branch: <BRANCH>
✓ Worktree: worktrees/<FOLDER>/
✓ IDE: Launched
```
