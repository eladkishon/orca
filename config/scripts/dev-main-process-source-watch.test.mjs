import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { watchMainProcessSources } from './dev-main-process-source-watch.mjs'

const cleanups = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup()
  }
})

function settle(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('watchMainProcessSources', () => {
  it('reports bundled source edits and ignores tests and docs', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'orca-dev-watch-'))
    cleanups.push(() => rmSync(root, { recursive: true, force: true }))
    mkdirSync(path.join(root, 'src/main/deep'), { recursive: true })
    writeFileSync(path.join(root, 'src/main/deep/a.ts'), 'export const a = 1\n')
    const bursts = []
    const stop = watchMainProcessSources({
      root,
      dirs: ['src/main', 'src/missing'],
      files: [],
      onChange: (changed) => bursts.push(changed),
      debounceMs: 100
    })
    cleanups.push(stop)
    // Why: recursive fs.watch arms asynchronously on macOS.
    await settle(300)

    writeFileSync(path.join(root, 'src/main/deep/a.ts'), 'export const a = 2\n')
    writeFileSync(path.join(root, 'src/main/deep/a.test.ts'), 'test\n')
    writeFileSync(path.join(root, 'src/main/deep/notes.md'), 'doc\n')
    await settle(600)

    // Why a set: FSEvents may split one write across bursts; the filter is the contract.
    expect(bursts.length).toBeGreaterThan(0)
    expect(new Set(bursts.flat())).toEqual(new Set([path.join('src/main', 'deep/a.ts')]))
  })
})
