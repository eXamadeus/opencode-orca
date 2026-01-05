---
description: Verify issue satisfaction and ship changes via PR
---

## /ship Command

Verify that current changes satisfy the linked issue, then commit and create a PR.

### Input
- Commit message override (optional): $ARGUMENTS

### Flow Overview

```
┌─────────────────────────────────────────────────────────┐
│                      /ship                              │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 1: Extract Issue from Branch                     │
│  - Parse branch name for issue number                   │
│  - Detect if on main branch                             │
└─────────────────────┬───────────────────────────────────┘
                      │
          ┌──── Issue found? ────┐
          │                      │
         YES                     NO (or on main)
          │                      │
          ▼                      ▼
   [Normal Flow]         ┌──────────────────────┐
   Phases 2-7            │ Phase 1B: Classify   │
                         │ - Analyze changes    │
                         │ - Infer work type    │
                         │ - Generate branch    │
                         │ - **STOP IF UNSURE** │
                         └──────────┬───────────┘
                                    │
                         ┌── Confident? ──┐
                         │                │
                        YES              NO
                         │                │
                         ▼                ▼
                  [Bonus Flow]      [ASK USER]
                  Phases 2,3B,      Wait for:
                  4B,5B,6B,7       - Work type
                                   - Branch name
```

**Branch naming:**
- Issue-linked: `<type>/<number>/<slug>` (e.g., `feat/42/add-profiles`)
- Bonus work: `<type>/<slug>` (e.g., `feat/add-bonus-flow`)

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

**If no number found OR on `main`/`master` branch:**

1. **Detect main branch:**
   ```bash
   CURRENT_BRANCH=$(git branch --show-current)
   ```
   
2. **If on main/master with changes:** Enter Bonus Work Flow → Go to Phase 1B

3. **If on feature branch without issue number:** Enter Bonus Work Flow → Go to Phase 1B

---

## Phase 1B: Bonus Work Classification

This phase handles untracked work (no issue number or on main branch).

### Analyze the Changes

```bash
git status --short
git diff HEAD --stat
git diff HEAD
```

### Infer Work Type

Based on the changes, attempt to classify:

| Change Pattern                        | Inferred Type | Branch Prefix |
| ------------------------------------- | ------------- | ------------- |
| New files in feature area             | `feat`        | `feat/`       |
| Bug fixes, error handling             | `fix`         | `fix/`        |
| Documentation only                    | `docs`        | `docs/`       |
| Config, dependencies, tooling         | `chore`       | `chore/`      |
| Restructuring without behavior change | `refactor`    | `refactor/`   |
| Mixed or unclear                      | **STOP AND ASK** | —          |

### Generate Branch Slug

From the changes, derive a 3-5 word kebab-case description:
- Look at primary file/directory being changed
- Look at nature of the change (add, fix, update, remove)
- Example: Adding a new config option → `add-config-option`

### CRITICAL: Uncertainty Check (MANDATORY)

**Before proceeding, evaluate confidence in these decisions:**

1. **Work type**: Can you clearly identify feat/fix/docs/chore/refactor?
2. **Branch name**: Does the generated slug accurately describe the changes?
3. **Scope**: Are the changes cohesive (single purpose)?

**If ANY of the following are true → STOP AND ASK:**

- Changes span multiple unrelated areas (mixed purposes)
- Cannot determine if this is a feature, fix, or chore
- Generated branch name feels vague or inaccurate
- Changes are large/complex without clear theme
- Any other uncertainty about how to proceed

**When stopping, ask:**

> I see uncommitted changes but I'm not certain how to categorize them:
> 
> **Changes detected:**
> - [list of changed files]
> 
> **My uncertainty:**
> - [specific uncertainty, e.g., "Can't tell if this is a fix or refactor"]
> 
> **Please tell me:**
> 1. Work type: feat / fix / docs / chore / refactor
> 2. Short description: (3-5 words for branch name)
> 
> Or provide a full branch name like `feat/add-new-feature`

Then **STOP** and wait for user input.

### If Confident, Proceed

**Computed values:**
- `BRANCH_TYPE`: The inferred type (feat, fix, etc.)
- `SLUG`: The generated kebab-case description
- `BRANCH`: `<BRANCH_TYPE>/<SLUG>` (e.g., `feat/add-bonus-work-flow`)
- `IS_BONUS_WORK`: true
- `ISSUE_NUMBER`: None

**Proceed to Phase 2**

---

## Phase 2: Check for Changes

```bash
git status --short
git diff --stat HEAD
git log origin/main..HEAD --oneline 2>/dev/null || echo "(on main)"
```

**Decision tree:**

| On Main | Uncommitted Changes | Unpushed Commits | Action                               |
| ------- | ------------------- | ---------------- | ------------------------------------ |
| Yes     | Yes                 | N/A              | Continue (bonus work flow)           |
| Yes     | No                  | N/A              | Say "No changes to ship" → STOP      |
| No      | Yes                 | Any              | Continue to Phase 3 or 3B            |
| No      | No                  | Yes              | Skip to Phase 5 or 5B (push/PR only) |
| No      | No                  | No               | Say "No changes to ship" → STOP      |

**Flow selection:**
- If `IS_BONUS_WORK` is true → use bonus phases (3B, 4B, 5B, 6B)
- If `IS_BONUS_WORK` is false → use normal phases (3, 4, 5, 6)

---

## Phase 3: Fetch and Analyze Issue

**Skip to Phase 3B if `IS_BONUS_WORK` is true.**

```bash
gh issue view <ISSUE_NUMBER>
```

Extract from issue:
- **ISSUE_TITLE**: The issue title
- **ISSUE_BODY**: The full issue body
- **ISSUE_LABELS**: Labels on the issue (for PR labels)
- **ACCEPTANCE_CRITERIA**: Look for checkbox items (`- [ ]` or `- [x]`) or numbered requirements

---

## Phase 3B: Bonus Work Context (No Issue)

**Applies when:** `IS_BONUS_WORK` is true

Since there's no linked issue, gather context from the changes themselves:

### Collect Evidence

```bash
# Full diff for context
git diff HEAD

# If commits exist on feature branch
git log origin/main..HEAD --oneline 2>/dev/null
```

### Set Values

- `ISSUE_NUMBER`: None (standalone work)
- `ISSUE_TITLE`: None
- `ISSUE_BODY`: None
- `ACCEPTANCE_CRITERIA`: None

**Proceed to Phase 4B**

---

## Phase 4: Verify Issue Satisfaction

**Skip to Phase 4B if `IS_BONUS_WORK` is true.**

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

## Phase 4B: Verify Bonus Work Readiness

**Applies when:** `IS_BONUS_WORK` is true

Since there's no issue to verify against, confirm the changes are ready to ship:

### Quality Checks

1. **Changes are coherent**: Single purpose, not a grab-bag of unrelated edits
2. **No WIP markers**: No TODO, FIXME, or incomplete code
3. **Tests pass** (if applicable): `bun test` or equivalent

### Summarize the Work

Provide a brief summary of what the changes accomplish:

> **Bonus work detected:**
> - Type: [BRANCH_TYPE]
> - Summary: [1-2 sentence description]
> - Files: [N files changed]
> - Branch will be: `[BRANCH_TYPE]/[SLUG]`
>
> Does this look right? (yes/no/adjust)

**If user says "adjust"**: Ask what to change (type, branch name, or both), then update and re-confirm.

**If user confirms**: Proceed to Phase 5B

---

## Phase 5: Commit Changes

**Skip to Phase 5B if `IS_BONUS_WORK` is true.**

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

## Phase 5B: Create Branch and Commit (Bonus Work)

**Applies when:** `IS_BONUS_WORK` is true AND on `main` branch

### Create Feature Branch

```bash
git checkout -b <BRANCH_TYPE>/<SLUG>
```

**Example:** `git checkout -b feat/add-bonus-work-flow`

### Determine Commit Message

**If $ARGUMENTS provided:** Use it as the commit message.

**Otherwise:** Generate conventional commit:

```
<BRANCH_TYPE>: <description>
```

Where `<description>` is derived from SLUG, expanded to sentence form.

**Example:**
- BRANCH_TYPE: `feat`
- SLUG: `add-bonus-work-flow`
- Commit: `feat: add bonus work flow to ship command`

### Execute Commit

```bash
git add -A
git commit -m "<commit_message>"
```

**Proceed to Phase 6B**

---

## Phase 6: Push and Create PR

**Skip to Phase 6B if `IS_BONUS_WORK` is true.**

### Push

```bash
git push -u origin <BRANCH_NAME>
```

### Check for Existing PR

```bash
gh pr list --head <BRANCH_NAME> --state open
```

**If PR already exists:** Skip PR creation, just report the existing PR URL.

### Create PR (if none exists)

**Delegate to `product-manager` agent** to craft the PR description:

Provide the PM with:
- ISSUE_NUMBER and ISSUE_TITLE
- ISSUE_BODY (including acceptance criteria)
- Commits on branch: `git log origin/main..HEAD --oneline`
- Files changed: `git diff origin/main..HEAD --stat`
- Branch name and labels

The PM will:
1. Write a professional PR description that:
   - Links to and quotes the user story from the issue
   - Shows acceptance criteria with checkmarks for completed items
   - Summarizes what was implemented
   - Groups changes by category (not raw file lists)
   - Highlights any bonus/extra work beyond the issue scope
2. Delegate to the `github` agent to create the PR with:
   - **Title**: ISSUE_TITLE verbatim
   - **Head branch**: current branch name
   - **Base branch**: `main`
   - **Labels**: From ISSUE_LABELS (filter to: `feature`, `bug`, `chore`)
   - **Body**: The crafted description

---

## Phase 6B: Push and Create PR (Bonus Work)

**Applies when:** `IS_BONUS_WORK` is true

### Push

```bash
git push -u origin <BRANCH_TYPE>/<SLUG>
```

### Check for Existing PR

```bash
gh pr list --head <BRANCH_TYPE>/<SLUG> --state open
```

**If PR already exists:** Skip PR creation, just report the existing PR URL.

### Create PR via PM Agent

**Delegate to `product-manager` agent** for bonus work PR creation:

Provide the PM with:
- `IS_BONUS_WORK`: true
- `BRANCH_TYPE`: The work type (feat, fix, etc.)
- `BRANCH`: The full branch name (e.g., `feat/add-bonus-work-flow`)
- Commits on branch: `git log origin/main..HEAD --oneline`
- Files changed: `git diff origin/main..HEAD --stat`
- Full diff: `git diff origin/main..HEAD`
- Commit messages: `git log origin/main..HEAD --format='%s%n%b'`

The PM will:
1. Analyze the changes to infer purpose
2. Craft a comprehensive PR description
3. Propose a PR title
4. **Confirm with user** before creating
5. Delegate to `github` agent to create the PR

**Proceed to Phase 7**

---

## Phase 7: Report

**For issue-linked work:**

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

**For bonus work (no issue):**

```
Shipped bonus work

  Commit: <commit_hash> <commit_message>
  Branch: <branch_name> -> origin
  PR: <PR_URL>

Ready for review!
```
