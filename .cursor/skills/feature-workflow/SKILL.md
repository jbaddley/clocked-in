---
name: feature-workflow
description: Ship a ClockedIn feature through a worktree, GitHub issue, local tests, staging, and a PR to main. Use only when the user explicitly starts a workflow, asks for the feature workflow, or says to ship through staging.
---

# Feature workflow

Only run this skill when the user explicitly asked to start a workflow. Do not start it for ordinary code changes.

CLI (from the primary repo root):

```bash
node .cursor/skills/feature-workflow/scripts/workflow.mjs <command>
```

Mechanical steps are the CLI. Do not hand-edit `.workflows/*.json`. All feature file edits go under `resolvedWorktreePath`, not the primary checkout. Commits and pushes are allowed for this skill.

## Start

1. `worktree-add --feature "<name>" --description "<text>"`
2. Use `resolvedWorktreePath` for every later command and file edit.
3. If this session is in plan mode: write the plan to `<worktree>/.workflows/plans/<id>.md`, run `set-plan <id> --path .workflows/plans/<id>.md`, then **stop**. Do not implement.

## After the plan is approved

Run these in order. `check <id> <step>` when a step finishes. `status <id> <status>` as you move.

1. `issue` — lookup or create. Check `issue`.
2. Implement in the worktree from the plan (or the description). Check `implement`.
3. Add/update HTTP contract tests and Playwright e2e. `test --target local` must pass. Check `tests`.
4. Commit in the worktree. `push-staging` → `wait-deploy --env staging` → `test --target staging` → verify the feature on `https://staging.clocked-in.baddley.us` with IronBee. Check `staging`.
5. `status <id> awaiting_staging_approval`. Tell the user staging is ready. **Stop.** Do not continue until they approve. After they approve, `check staging-approval`.
6. `create-pr`. `status <id> awaiting_pr_approval`. Tell the user to approve/merge. Do not merge. Check `pr`. **Stop.**
7. After they say the PR is approved: `wait-pr-merged` → `wait-deploy --env production` → `test --target production` → IronBee on `https://clocked-in.baddley.us`. Check `production`. `status <id> done`. `worktree-remove`.

## Commands

`show [id]`, `set-issue`, `set-pr`, `set-sha`, `status`, `check`, `init` (recovery only). `worktree-remove` requires `status=done` unless `--force`.

Do not delete `origin/staging` or `main`. Do not leave the worktree after a successful production verify.
