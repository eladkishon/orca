import { execFileSync } from 'node:child_process'

/**
 * The full commit this build is made from. Official skill installs pin to it, so the
 * skills an Orca build installs are the ones it bundles on every release channel.
 */
export function resolveBuildSourceCommit() {
  let commit = ''
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch (error) {
    throw new Error(
      `Could not read the source commit with \`git rev-parse HEAD\`: ${
        error instanceof Error ? error.message : String(error)
      }. Orca builds must run from a git checkout so official skills can pin to it.`
    )
  }
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error(`\`git rev-parse HEAD\` returned "${commit}", not a full commit hash.`)
  }
  return upstreamCommitFor(commit)
}

// Why: a fork build's HEAD is not on stablyai/orca, so pinning skills to it makes
// `skills add` fail to clone. Fall back to the newest upstream commit it contains.
function upstreamCommitFor(commit) {
  try {
    const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
    if (git('for-each-ref', '--contains', commit, 'refs/remotes/origin')) {
      return commit
    }
    const base = git('merge-base', commit, 'origin/main')
    return /^[0-9a-f]{40}$/.test(base) ? base : commit
  } catch {
    return commit
  }
}
