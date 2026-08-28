# Agent Dashboard — request queue

One PR branch per item off `origin/main` where it applies; the board work that
builds on unmerged branches lives on `elad/all` until those land.

## Done

### Shipped as PRs off `origin/main`

- [x] **PR badge top-right with CI status, Linear ticket button, provider name
      bottom-left.** PR #16856.
- [x] **Esc no longer interrupts the agent in a preview; Ctrl+C does.** PR #16857.
- [x] **Remove-worktree button on idle cards.** PR #16858.
- [x] **The command each agent is running, on its card.** PR #16860.
- [x] **"Open worktree" keeps the preview open.** PR #16866.

### On `elad/all` (builds on the branches above)

- [x] Projects are the columns; state sorts rather than segregates.
- [x] State on the card's ring: colour for the state, a slow breath for
      "not settled", stillness for stalled. Unopened finished work breathes too.
- [x] Stall reason on the frame — logged out, network, rate limited, or the
      tool it is waiting on.
- [x] Pace from status silence: advancing, slow, stalled.
- [x] Activity badge — the kind of work and what it is on.
- [x] Recent steps, collapsed, per card.
- [x] Detail mode and a rows layout.
- [x] Per-project hue, wash, and generated banners; banner images cropped and
      compressed on import, offered from the repo's own pictures.
- [x] Efficiency toggle: share of the week and re-sent context, per card and
      per project, with a per-project daily trend.
- [x] End a session from the preview; remove a worktree from a card's context
      menu; a primary checkout is offered its session instead.
- [x] Start a new agent for a project from its heading.
- [x] Weekly budget for the signed-in account, in the header.

### Elsewhere

- [x] **Switch accounts automatically on a usage limit** (Settings → Accounts),
      rotating once through the provider's accounts and continuing the agents
      that limit stopped.
- [x] **Remove a project whose machine is unreachable**, bounded so the row does
      not sit there while a sleeping host times out.

## Not built, and why

- [ ] **Live terminal preview per card.** Twice attempted, twice reverted: a
      PTY subscription per card kills the terminal dialog's own subscription
      (`connect` is keyed per window+pty and disposes the previous one) and
      puts `serializeTerminalBuffer` on the thread drawing the terminal you are
      typing into. The readable summary on each card is what replaced it.
- [ ] **Unused skills and context-window occupancy.** Orca records neither.
      Showing them would mean inventing numbers, which would make the measured
      ones beside them untrustworthy.
- [ ] **Model-summarised card titles.** Orca has no lightweight completion
      path; every text-generation operation spawns an agent CLI through lanes
      and model discovery. The activity badge and the step trail were the
      cheaper answer to the same question.

## Unverified (built, never exercised live)

- [ ] OSC 8 link fix in the dashboard preview — unit-tested, never clicked.
- [ ] Stalled-agents hover popover — row logic unit-tested, hover never used.
