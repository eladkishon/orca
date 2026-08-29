const FALLBACK_COLS = 80
const FALLBACK_ROWS = 24

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** The grid a preview terminal is built at: the pty's own, kept sane. */
export function previewTerminalGridSize(snapshot: { cols?: number | null; rows?: number | null }): {
  cols: number
  rows: number
} {
  return {
    cols: clamp(snapshot.cols ?? FALLBACK_COLS, 2, 500),
    rows: clamp(snapshot.rows ?? FALLBACK_ROWS, 2, 200)
  }
}
