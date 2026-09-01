import { beforeEach, describe, expect, it, vi } from 'vitest'

const { gitExecFileAsyncMock } = vi.hoisted(() => ({
  gitExecFileAsyncMock: vi.fn()
}))

vi.mock('./runner', () => ({ gitExecFileAsync: gitExecFileAsyncMock }))
vi.mock('./status', () => ({
  runWithGitReadCacheInvalidation: (fn: () => Promise<void>) => fn()
}))

import { describeResetToBaseDirtyWorktree } from '../../shared/git-reset-to-base'
import { gitResetToBase } from './reset-to-base'

const OID = '1'.repeat(40)

function argvOf(call: unknown[]): string[] {
  return call[0] as string[]
}

describe('gitResetToBase', () => {
  beforeEach(() => {
    gitExecFileAsyncMock.mockReset()
  })

  it('fetches the remote base and hard-resets onto its resolved oid', async () => {
    gitExecFileAsyncMock
      .mockResolvedValueOnce({ stdout: '' }) // status --porcelain
      .mockResolvedValueOnce({ stdout: 'origin\n' }) // remote
      .mockResolvedValueOnce({ stdout: '' }) // check-ref-format
      .mockResolvedValueOnce({ stdout: '' }) // fetch
      .mockResolvedValueOnce({ stdout: `${OID}\n` }) // rev-parse
      .mockResolvedValueOnce({ stdout: '' }) // checkout -B

    await gitResetToBase('/repo', 'origin/main')

    const argvs = gitExecFileAsyncMock.mock.calls.map(argvOf)
    expect(argvs).toContainEqual(['fetch', 'origin', '+refs/heads/main:refs/remotes/origin/main'])
    // The whole point: end up ON main, not on the merged branch pointed at main's commit.
    expect(argvs.at(-1)).toEqual(['checkout', '-B', 'main', 'refs/remotes/origin/main'])
  })

  it('refuses a dirty worktree before touching the remote, naming what is dirty', async () => {
    gitExecFileAsyncMock.mockResolvedValueOnce({
      stdout: ' M src/index.ts\n M docs/readme.md\n'
    })

    await expect(gitResetToBase('/repo', 'origin/main')).rejects.toThrow(
      'src/index.ts, docs/readme.md'
    )
    expect(gitExecFileAsyncMock).toHaveBeenCalledTimes(1)
  })

  it('stashes tracked changes instead of refusing when asked to', async () => {
    gitExecFileAsyncMock
      .mockResolvedValueOnce({ stdout: ' M src/index.ts\n' }) // status --porcelain
      .mockResolvedValueOnce({ stdout: '' }) // stash push
      .mockResolvedValueOnce({ stdout: 'origin\n' }) // remote
      .mockResolvedValueOnce({ stdout: '' }) // check-ref-format
      .mockResolvedValueOnce({ stdout: '' }) // fetch
      .mockResolvedValueOnce({ stdout: `${OID}\n` }) // rev-parse
      .mockResolvedValueOnce({ stdout: '' }) // checkout -B

    await gitResetToBase('/repo', 'origin/main', { stashChanges: true })

    const argvs = gitExecFileAsyncMock.mock.calls.map(argvOf)
    expect(argvs[1]).toEqual(['stash', 'push', '--message', 'orca: before reset to origin/main'])
    expect(argvs.at(-1)).toEqual(['checkout', '-B', 'main', 'refs/remotes/origin/main'])
  })

  it('caps the named paths so a wholly dirty tree stays readable', () => {
    const message = describeResetToBaseDirtyWorktree(' M a\n M b\n M c\n M d\n M e\n')

    expect(message).toContain('(a, b, c, +2 more)')
  })
})
