# Agent Dashboard — request queue

Working branch: `feat/dashboard-card-project-grouping` (off `origin/main`),
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

## Queued

- [ ] **PR badge: bigger, top-right of the card, with CI status.**
      Currently a 10px pill in the footer. CI needs plumbing: the checks state
      exists as `HostedReviewInfo.status` (`pr.checksStatus`,
      `'pending' | 'success' | 'failure' | 'neutral'`) but `resolveReview()` in
      `dashboard-card-context.ts` drops it — it returns only `{number, state}`.
      So this needs an additive `checksStatus` on `DashboardCardReview`, through
      the snapshot + its main-process validator.
- [ ] **Linear ticket button next to the PR badge when one is linked.**
      `worktree.linkedLinearIssue` exists in the store but is not on
      `DashboardCard`, so this needs an additive snapshot field too — pairs
      naturally with the PR-badge work above.
- [ ] **Provider icon with its name, bottom-left, smaller.**
- [ ] **Live mini terminal preview per card**, so the board shows what every
      agent is actually doing from one view.
      Feasibility confirmed: `terminalPreview:connect` is per-(window, ptyId)
      and does NOT resize anything — only `fit()` claims the PTY grid, which a
      card preview must never call, or it would resize the real agent terminals.
      `card-preview-slots.ts` (slot rationing, cap 12) is written; the read-only
      preview component and viewport gating are not.
- [ ] **Idle cards: remove-worktree button.** Destructive — needs a confirm and
      should reuse the existing worktree-removal flow rather than a new path.
- [ ] **Esc must not interrupt the agent in the preview; require Ctrl+C.**
      `AgentTerminalDialog` currently forwards Esc to the terminal on purpose
      (there is a comment saying Esc must reach the agent); that intent flips.

## Unverified (built, never exercised live)

- [ ] OSC 8 link fix in the dashboard preview — unit-tested, never clicked.
- [ ] Stalled-agents hover popover — row logic unit-tested, hover never used.
