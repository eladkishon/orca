/**
 * Waits for a promise, but only for so long.
 *
 * For work that is best-effort: a remote cleanup whose failure the caller has
 * already decided to tolerate should not also cost the user the transport's
 * full timeout staring at an unchanged screen. A host that is up answers in
 * milliseconds, so a short deadline changes nothing for it and everything for
 * a host that is asleep.
 */

export type DeadlineOutcome<T> =
  | { settled: true; value: T }
  | { settled: true; error: unknown }
  | { settled: false }

export async function settleWithinDeadline<T>(
  work: Promise<T>,
  deadlineMs: number
): Promise<DeadlineOutcome<T>> {
  // Why: the work keeps running after the deadline — it is still worth doing,
  // and an unobserved rejection would otherwise surface as an unhandled one.
  work.catch(() => undefined)
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<DeadlineOutcome<T>>((resolve) => {
    timer = setTimeout(() => resolve({ settled: false }), deadlineMs)
  })
  try {
    return await Promise.race([
      work.then(
        (value): DeadlineOutcome<T> => ({ settled: true, value }),
        (error: unknown): DeadlineOutcome<T> => ({ settled: true, error })
      ),
      expired
    ])
  } finally {
    clearTimeout(timer)
  }
}
