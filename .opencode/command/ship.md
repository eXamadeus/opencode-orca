---
description: Verify issue satisfaction and ship changes via PR
---

## /ship Command

Verify that current changes satisfy the linked issue, then commit and create a PR.

### Input
- Commit message override (optional): $ARGUMENTS

---

## Phase 1: Extract Issue from Branch

Get the current branch name and extract the issue number:

```bash
git branch --show-current
```

**Parsing rules:**
- Branch format: `<tag>/<number>/<slug>` (e.g., `feat/12/per-agent-supervision`)
- Extract `<number>` as ISSUE_NUMBER
- Extract `<tag>` as BRANCH_TYPE for commit type mapping

**If no number found:**
> Could not determine issue number from branch name.
> Expected format: `type/123/description`

Then STOP.

---

## Phase 2: Check for Changes

```bash
git status --short
git diff --stat HEAD
git log origin/main..HEAD --oneline
```

**Decision tree:**

| Uncommitted Changes | Unpushed Commits | Action                           |
| ------------------- | ---------------- | -------------------------------- |
| Yes                 | Any              | Continue to Phase 3              |
| No                  | Yes              | Skip to Phase 5 (push/PR only)   |
| No                  | No               | Say "No changes to ship" → STOP  |

---

## Phase 3: Fetch and Analyze Issue

```bash
gh issue view <ISSUE_NUMBER>
```

Extract from issue:
- **ISSUE_TITLE**: The issue title
- **ISSUE_BODY**: The full issue body
- **ISSUE_LABELS**: Labels on the issue (for PR labels)
- **ACCEPTANCE_CRITERIA**: Look for checkbox items (`- [ ]` or `- [x]`) or numbered requirements

---

## Phase 4: Verify Issue Satisfaction

Analyze whether the changes satisfy the issue requirements.

**Review the evidence:**
1. Commits on branch: `git log origin/main..HEAD --oneline`
2. Files changed: `git diff --stat` (uncommitted) or `git diff origin/main..HEAD --stat` (committed)
3. Detailed changes: `git diff` or `git diff origin/main..HEAD`

**Compare against acceptance criteria:**
- For each criterion, determine if commits/changes address it
- Note any criteria that appear unaddressed

**Decision tree:**

**If ALL criteria appear satisfied:**
- Report: "All acceptance criteria appear satisfied"
- Continue to Phase 5

**If SOME criteria appear unaddressed:**
- List which criteria are not addressed
- Ask: "Continue shipping anyway, or address these first? (ship/stop)"
- If user says ship → proceed to Phase 5
- If user says stop → STOP

**If NO acceptance criteria found in issue:**
- Summarize what the changes do
- Ask: "Does this satisfy issue #ISSUE_NUMBER? (yes/no)"
- If yes → proceed to Phase 5
- If no → STOP

### Extra/Bonus Work Handling

If the user indicates the changes are:
- "Extra work" or "bonus" unrelated to the main issue
- A quick fix discovered while working on the issue
- Additional improvements beyond the issue scope

Then:
1. **Skip verification** — don't fail because changes don't match acceptance criteria
2. **Ask for a commit message** if not provided via $ARGUMENTS
3. The PR will still reference the issue for context (branch linkage), but the commit message should describe the actual changes
4. Proceed directly to Phase 5

---

## Phase 5: Commit Changes

**Skip this phase if no uncommitted changes.**

### Determine Commit Message

**If $ARGUMENTS provided:** Use it as the commit message.

**Otherwise:** Generate conventional commit message:

```
<type>: <description> (#<ISSUE_NUMBER>)
```

**Type mapping** (from BRANCH_TYPE):
| Branch Prefix | Commit Type |
| ------------- | ----------- |
| `feat`          | `feat`        |
| `feature`       | `feat`        |
| `fix`           | `fix`         |
| `chore`         | `chore`       |
| `docs`          | `docs`        |
| `refactor`      | `refactor`    |
| (other)       | `feat`        |

**Description:** Derive from ISSUE_TITLE, lowercased, imperative mood.

### Execute Commit

```bash
git add -A
git commit -m "<commit_message>"
```

---

## Phase 6: Push and Create PR

Delegate to `github` agent with full specifics:

### Push

```
Push current branch to origin with -u flag for upstream tracking
```

### Check for Existing PR

```bash
gh pr list --head <BRANCH_NAME> --state open
```

**If PR already exists:** Skip PR creation, just report the existing PR URL.

### Create PR (if none exists)

Delegate to `github` agent:

- **Title**: Use ISSUE_TITLE verbatim
- **Head branch**: current branch name
- **Base branch**: `main`
- **Labels**: Copy from ISSUE_LABELS (filter to: `feature`, `bug`, `chore`)
- **Body**: Generate from this template:

```markdown
## Summary

<2-3 bullets summarizing the key changes, derived from commits>

## Changes

<git diff --stat summary against main>

---

Closes #<ISSUE_NUMBER>
```

---

## Phase 7: Report

Output to user:

```
Shipped #<ISSUE_NUMBER>

  Commit: <commit_hash> <commit_message>
  Branch: <branch_name> -> origin
  PR: <PR_URL>

Ready for review!
```

Or if PR already existed:

```
Shipped #<ISSUE_NUMBER>

  Commit: <commit_hash> <commit_message>
  Branch: <branch_name> -> origin
  PR: <PR_URL> (existing)

Ready for review!
```
