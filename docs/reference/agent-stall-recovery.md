# Agent stall recovery

When an agent CLI hits an expired login or a network failure mid-turn, it prints the error and
returns to its prompt. The turn is over, the work is unfinished, and nothing in Orca knows why —
agent hooks report `working` / `blocked` / `waiting` / `done` and carry no failure cause, so that
turn looks exactly like one that completed.

That is survivable for one agent. It is not survivable for a fleet: one expired token or one
dropped uplink stalls every agent in the workspace at the same moment, and every one of them has
to be found and continued by hand.

This subsystem detects those stalls and continues all of them.

## Pipeline

| Stage | Module | Notes |
| --- | --- | --- |
| Classify | `src/shared/agent-stall-signature.ts` | One line in → `auth` / `network` / nothing. Pure. |
| Detect | `src/renderer/src/components/terminal-pane/agent-stall-detector.ts` | Per-pane rolling scanner on the PTY byte path. |
| Record | `src/renderer/src/store/slices/agent-stall-recovery.ts` | Observation per pane + attempt ledger. Both self-bounding. |
| Read facts | `src/renderer/src/lib/stalled-agent-pane-facts.ts` | Agent, hook status, process liveness, addressability. |
| Decide | `src/shared/agent-stall-recovery-policy.ts` | Fleet-wide plan with settle / backoff / attempt fences. Pure. |
| Execute | `src/renderer/src/lib/recover-stalled-agent-panes.ts` | Nudge, or relaunch with `--resume`. |
| Schedule | `src/renderer/src/lib/stalled-agent-recovery-scheduler.ts` | Polls only while a stall is outstanding. |

The detector is created only for panes launched with a resumable agent
(`run-deferred-connect.ts`). A pane running a build prints the same connection errors and has
nothing to resume, and the scan is on the byte path.

## The two recovery actions

- **Nudge** — the agent process is still alive at its prompt, which is what Claude, Codex, and
  Gemini actually do after an API auth or network error. Recovery sends a continue prompt through
  `active-agent-note-send`, which already resolves the worktree's owner host, waits for the TUI to
  be idle, and refuses to type into a pane the runtime does not report as a live agent.
- **Relaunch** — the agent process exited. Recovery types the `--resume` line built by
  `buildAgentResumeStartupPlan` into the pane's live shell, the same construction the
  sleeping-agent resume and the pane cold restore use. A pane with no provider session is reported
  as `not-resumable` and left alone rather than restarted from scratch.

A nudge that comes back `no-agent` falls through to relaunch: the pane's foreground evidence is
read at shell command boundaries and can be one boundary behind, so the runtime is the authority.

## What keeps it from becoming a restart loop

A genuinely broken login keeps printing the same failure, so every attempt is fenced:

- **Settle window** — 15 s for network (the CLIs retry transient HTTP/DNS failures internally;
  nudging early would double-submit the turn), 5 s for auth (no internal retry exists).
- **Exponential backoff** — from 30 s (network) or 2 min (auth), capped at 8 min / 15 min.
- **Attempt cap** — 5 network, 6 auth, per episode.
- **Episode reset** — a failure seen more than 30 min after the last attempt starts a new episode
  with a fresh budget, so an exhausted pane degrades to a slow poll instead of being abandoned for
  the renderer's lifetime, including after the user fixes the login.
- **Self-healing skip** — a pane whose hook status is `working` with output newer than the
  observation is left alone.

The status-bar segment's Resume action passes `force`, which skips the settle, backoff, and
attempt fences — the user has said the waiting is over — but never the fences that describe panes
recovery cannot act on at all (no resumable agent, no addressable pane, expired observation).

## False positives are the expensive failure

Recovering a healthy agent interrupts real work, so the classifier defaults to "not a stall":

- Failures a restart cannot fix are matched first and always return nothing: credit balance, rate
  limits (Orca models those in its own rate-limit subsystem, which knows the reset time),
  unsupported model, oversized prompt, filesystem permissions.
- Wording that is ordinary prose ("network", "timeout", "connect") only counts alongside a failure
  marker on the same line.
- Lines that quote rather than report — diff hunks, `echo`/`grep`, `console.error`, `throw new` —
  are rejected outright. An agent editing error-handling code is the single largest source of
  false positives.

## Settings

`autoRecoverStalledAgents` (Settings → Agents → "Auto-continue stalled agents"). On unless
explicitly disabled. With it off, stalls are still detected and shown in the status bar; only the
automatic walk stops.
