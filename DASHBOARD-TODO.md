# Agent Dashboard — request queue

One PR branch per item, each off `origin/main`,
merged into `elad/all` as items land.

## Done

- [x] **Group columns by project** — cards blocked under the project they belong
      to. Identity comes from `card.repoId`/`repoName`, which the snapshot
      builder already fills from `workspace.projectId`/`projectName` (so a
      folder workspace resolves to its project group and grouping matches the
      project filter exactly).
- [x] **Containerize each project** — one bordered box per repo, all its agents
      inside it, rather than a loose heading over a flat list.
- [x] **Bigger project header** — 13px semibold foreground + larger repo glyph.
- [x] **PR badge: bigger, top-right of the card, with CI status.** PR #16856.
      `resolveReview()` now carries `HostedReviewInfo.status` and the review URL
      through as additive `checksStatus`/`url` on `DashboardCardReview`; the
      badge moved to the card's top-right corner and became a link.
- [x] **Linear ticket button next to the PR badge.** PR #16856. Additive
      `linearIssue` card field from `worktree.linkedLinearIssue`, linked via the
      existing `buildLinearIssueUrl`; inert (still named) with no org key.
- [x] **Provider icon with its name, bottom-left, smaller.** PR #16856.
- [x] **Esc must not interrupt the agent in the preview; require Ctrl+C.**
      PR #16857. The preview's key handler refuses a bare Escape, so no `\x1b`
      reaches the PTY and the keystroke closes the preview instead. Folded into
      the existing handler — xterm keeps only one `attachCustomKeyEventHandler`,
      so a second would have replaced the whole shortcut policy.
- [x] **Idle cards: remove-worktree button.** PR #16858. Hover-revealed, idle
      only; the pop-out names the workspace and the main renderer runs
      `runWorktreeDelete`, so the sidebar's confirm and guards still apply.

## Queued

- [ ] **Live mini terminal preview per card**, so the board shows what every
      agent is actually doing from one view.
      Feasibility confirmed: `terminalPreview:connect` is per-(window, ptyId)
      and does NOT resize anything — only `fit()` claims the PTY grid, which a
      card preview must never call, or it would resize the real agent terminals.
      `card-preview-slots.ts` (slot rationing, cap 12) is written; the read-only
      preview component and viewport gating are not.

## Unverified (built, never exercised live)

- [ ] OSC 8 link fix in the dashboard preview — unit-tested, never clicked.
- [ ] Stalled-agents hover popover — row logic unit-tested, hover never used.
