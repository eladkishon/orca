/**
 * Watches the sources that only a main-process rebuild can pick up (src/main,
 * src/preload, src/shared and the electron-vite config), debounced into one
 * callback per burst.
 *
 * Why not `electron-vite dev --watch`: its rolldown watcher goes quiet after a
 * couple of rebuilds and never reports why, so an edit silently keeps the
 * startup build running. Node's own recursive fs.watch has no such ceiling.
 */

import { existsSync, watch } from 'node:fs'
import path from 'node:path'

/** Tests, snapshots and docs never reach the bundle; editor droppings never should. */
const IGNORED_PATTERN = /(^|[\\/])(__snapshots__|\.DS_Store)|\.(test|spec)\.[cm]?[jt]sx?$|\.md$|~$/
const BUNDLED_SOURCE_PATTERN = /\.([cm]?[jt]s|json)$/

export function watchMainProcessSources({ root, dirs, files, onChange, debounceMs = 300 }) {
  let timer = null
  const pending = new Set()
  const fire = (target) => {
    pending.add(target)
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      timer = null
      const changed = [...pending]
      pending.clear()
      onChange(changed)
    }, debounceMs)
  }
  const watchers = []
  const tryWatch = (absolute, options, listener) => {
    try {
      watchers.push(watch(absolute, { persistent: false, ...options }, listener))
    } catch (error) {
      console.error(`[orca-dev] cannot watch ${absolute}: ${error?.message ?? error}`)
    }
  }
  for (const dir of dirs) {
    const absolute = path.join(root, dir)
    if (!existsSync(absolute)) {
      continue
    }
    tryWatch(absolute, { recursive: true }, (_event, filename) => {
      if (!filename || IGNORED_PATTERN.test(filename) || !BUNDLED_SOURCE_PATTERN.test(filename)) {
        return
      }
      fire(path.join(dir, filename))
    })
  }
  for (const file of files) {
    const absolute = path.join(root, file)
    if (existsSync(absolute)) {
      tryWatch(absolute, {}, () => fire(file))
    }
  }
  return () => {
    if (timer) {
      clearTimeout(timer)
    }
    for (const watcher of watchers) {
      watcher.close()
    }
  }
}
