/** localStorage throws in a few embedding contexts, and a board that fails to
 *  render because a preference could not be read is worse than one that forgets. */
export function readStoredFlag(key: string): boolean | null {
  try {
    const stored = globalThis.localStorage?.getItem(key)
    return stored === null || stored === undefined ? null : stored === '1'
  } catch {
    return null
  }
}

export function writeStoredFlag(key: string, value: boolean): void {
  try {
    globalThis.localStorage?.setItem(key, value ? '1' : '0')
  } catch {
    // Preference-only: a board that works is worth more than a remembered toggle.
  }
}
