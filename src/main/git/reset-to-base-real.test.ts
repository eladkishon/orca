import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { gitResetToBase } from './reset-to-base'

/** Mocked argv assertions cannot catch a command Git itself rejects, and this one rewrites a checkout. */
describe('gitResetToBase real Git contract', () => {
  const tempPaths: string[] = []

  afterEach(() => {
    for (const path of tempPaths.splice(0)) {
      rmSync(path, { recursive: true, force: true })
    }
  })

  function makeMergedCheckout(): {
    clonePath: string
    git: (...args: string[]) => string
    mergedOid: string
  } {
    const root = mkdtempSync(join(tmpdir(), 'orca-reset-to-base-'))
    tempPaths.push(root)
    const originPath = join(root, 'origin.git')
    const clonePath = join(root, 'clone')
    const run = (cwd: string, ...args: string[]): string =>
      execFileSync('git', args, { cwd, encoding: 'utf8' })

    execFileSync('git', ['init', '--quiet', '--bare', '--initial-branch=main', originPath])
    execFileSync('git', ['clone', '--quiet', originPath, clonePath])
    const git = (...args: string[]): string => run(clonePath, ...args)
    git('config', 'user.name', 'Orca Test')
    git('config', 'user.email', 'orca@example.test')
    git('config', 'commit.gpgSign', 'false')
    git('config', 'core.hooksPath', '.git/no-hooks')
    writeFileSync(join(clonePath, 'tracked.txt'), 'base\n')
    git('add', 'tracked.txt')
    git('commit', '--quiet', '-m', 'base')
    git('branch', '-M', 'main')
    git('push', '--quiet', '-u', 'origin', 'main')

    // The worktree sits on a feature branch whose work has since landed on origin/main.
    git('checkout', '--quiet', '-b', 'feature/merged')
    writeFileSync(join(clonePath, 'tracked.txt'), 'feature\n')
    git('commit', '--quiet', '-am', 'feature work')
    git('push', '--quiet', '-u', 'origin', 'feature/merged')
    git('push', '--quiet', 'origin', 'feature/merged:main')
    const mergedOid = git('rev-parse', 'HEAD').trim()
    // Drop the remote-tracking ref so the fetch inside the op is what refreshes it.
    git('update-ref', '-d', 'refs/remotes/origin/main')
    return { clonePath, git, mergedOid }
  }

  it('lands the checkout ON the default branch, not on the merged branch', async () => {
    const { clonePath, git, mergedOid } = makeMergedCheckout()

    await gitResetToBase(clonePath, 'origin/main')

    expect(git('branch', '--show-current').trim()).toBe('main')
    expect(git('rev-parse', 'HEAD').trim()).toBe(mergedOid)
    expect(git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}').trim()).toBe(
      'origin/main'
    )
    // The branch left behind still exists at its own tip.
    expect(git('rev-parse', 'feature/merged').trim()).toBe(mergedOid)
  })

  it('refuses a dirty worktree and changes nothing', async () => {
    const { clonePath, git } = makeMergedCheckout()
    writeFileSync(join(clonePath, 'tracked.txt'), 'uncommitted edit\n')

    await expect(gitResetToBase(clonePath, 'origin/main')).rejects.toThrow('tracked.txt')

    expect(git('branch', '--show-current').trim()).toBe('feature/merged')
    expect(readFileSync(join(clonePath, 'tracked.txt'), 'utf8')).toBe('uncommitted edit\n')
  })

  it('stashes the dirty files when asked, then switches', async () => {
    const { clonePath, git, mergedOid } = makeMergedCheckout()
    writeFileSync(join(clonePath, 'tracked.txt'), 'uncommitted edit\n')

    await gitResetToBase(clonePath, 'origin/main', { stashChanges: true })

    expect(git('branch', '--show-current').trim()).toBe('main')
    expect(git('rev-parse', 'HEAD').trim()).toBe(mergedOid)
    expect(git('stash', 'list')).toContain('orca: before reset to origin/main')
    // The edit is recoverable, which is the whole promise of the stash offer.
    git('stash', 'pop')
    expect(readFileSync(join(clonePath, 'tracked.txt'), 'utf8')).toBe('uncommitted edit\n')
  })

  it('creates the default branch when this checkout never had it', async () => {
    const { clonePath, git, mergedOid } = makeMergedCheckout()
    git('branch', '-D', 'main')

    await gitResetToBase(clonePath, 'origin/main')

    expect(git('branch', '--show-current').trim()).toBe('main')
    expect(git('rev-parse', 'HEAD').trim()).toBe(mergedOid)
  })
})
