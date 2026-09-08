/**
 * Owns the electron-vite dev child: launch, Ctrl+C teardown, and a relaunch
 * whenever a main-process source changes. One process group per child, so
 * every kill takes Electron down with it; a forced kill follows five seconds
 * later because Orca's quit guards can veto the graceful one.
 */

import { spawn } from 'node:child_process'
import { watchMainProcessSources } from './dev-main-process-source-watch.mjs'

const FORCED_KILL_DELAY_MS = 5000

function signalExitCode(signal) {
  if (signal === 'SIGINT') {
    return 130
  }
  if (signal === 'SIGTERM') {
    return 143
  }
  return 1
}

export function runElectronViteDevPipeline({ repoRoot, electronViteCli, args }) {
  let child = null
  let isShuttingDown = false
  let restartPending = false
  let forcedKillTimer = null

  const terminateChild = (signal) => {
    if (!child?.pid) {
      return
    }
    if (process.platform === 'win32') {
      const taskkill = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true
      })
      taskkill.unref()
      return
    }
    try {
      process.kill(-child.pid, signal)
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null
      if (code !== 'ESRCH') {
        throw error
      }
    }
  }

  const killChildTree = (signal) => {
    terminateChild(signal)
    forcedKillTimer = setTimeout(() => {
      terminateChild('SIGKILL')
    }, FORCED_KILL_DELAY_MS)
  }

  const onChildError = (error) => {
    if (forcedKillTimer) {
      clearTimeout(forcedKillTimer)
    }
    console.error(error)
    process.exit(1)
  }

  const onChildExit = (code, signal) => {
    if (forcedKillTimer) {
      clearTimeout(forcedKillTimer)
      forcedKillTimer = null
    }
    if (restartPending && !isShuttingDown) {
      restartPending = false
      launch()
      return
    }
    if (isShuttingDown) {
      process.exit(signalExitCode(signal ?? 'SIGINT'))
      return
    }
    if (signal) {
      process.exit(signalExitCode(signal))
      return
    }
    process.exit(code ?? 1)
  }

  const launch = () => {
    child = spawn(process.execPath, [electronViteCli, ...args], {
      stdio: 'inherit',
      env: process.env,
      // Why: electron-vite launches Electron as a descendant process. Giving the
      // dev runner its own process group lets Ctrl+C kill the whole tree on macOS
      // instead of leaving the Electron app alive after the terminal exits.
      detached: process.platform !== 'win32'
    })
    child.on('error', onChildError)
    child.on('exit', onChildExit)
  }

  const beginShutdown = (signal) => {
    if (isShuttingDown) {
      return
    }
    isShuttingDown = true
    killChildTree(signal)
  }

  const restartForMainProcessChange = (changed) => {
    if (isShuttingDown || restartPending || !child?.pid) {
      return
    }
    restartPending = true
    console.error(
      `[orca-dev] ${changed[0]} changed; rebuilding main process and relaunching Electron`
    )
    killChildTree('SIGTERM')
  }

  process.on('SIGINT', () => beginShutdown('SIGINT'))
  process.on('SIGTERM', () => beginShutdown('SIGTERM'))
  watchMainProcessSources({
    root: repoRoot,
    dirs: ['src/main', 'src/preload', 'src/shared'],
    files: ['electron.vite.config.ts'],
    onChange: restartForMainProcessChange
  })
  launch()
}
