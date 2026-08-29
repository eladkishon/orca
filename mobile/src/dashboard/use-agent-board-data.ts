import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCachedWorktrees, setCachedWorktrees } from '../cache/worktree-cache'
import { loadHosts } from '../transport/host-store'
import { useHostClient } from '../transport/client-context'
import { useAllHostClients } from '../transport/use-all-host-clients'
import type { RpcClient } from '../transport/rpc-client'
import type { ConnectionState } from '../transport/types'
import type { RepoIcon } from '../../../src/shared/repo-icon'
import { sanitizeRepoBanner, type RepoBanner } from '../../../src/shared/repo-banner'
import type { RepoSummary } from '../worktree/host-worktree-rpc-types'
import { startHostWorktreeRefresh } from '../worktree/host-worktree-refresh'
import { WORKTREE_PS_FULL_LIMIT } from '../worktree/worktree-catalog-snapshot-client'
import type { BoardWorktree } from './agent-dashboard-board'

export type AgentBoardHost = {
  hostId: string
  name: string
  client: RpcClient
  state: ConnectionState
}

/**
 * The hosts a board covers: one when it was opened from a host, every paired
 * host when it was opened from Home. Both are read unconditionally — a hook
 * cannot be called on a branch — and the unused one is asked for nothing.
 */
export function useAgentBoardHosts(hostId?: string): AgentBoardHost[] {
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [allHostIds, setAllHostIds] = useState<string[]>([])
  const single = useHostClient(hostId)
  const many = useAllHostClients(hostId ? [] : allHostIds)

  useEffect(() => {
    let disposed = false
    void loadHosts().then((hosts) => {
      if (disposed) {
        return
      }
      setNames(new Map(hosts.map((host) => [host.id, host.name])))
      setAllHostIds(hosts.map((host) => host.id))
    })
    return () => {
      disposed = true
    }
  }, [])

  return useMemo(() => {
    if (hostId) {
      return single.client
        ? [
            {
              hostId,
              name: names.get(hostId) ?? 'Host',
              client: single.client,
              state: single.state
            }
          ]
        : []
    }
    return many.map((entry) => ({
      hostId: entry.hostId,
      name: names.get(entry.hostId) ?? 'Host',
      client: entry.client,
      state: entry.state
    }))
  }, [hostId, many, names, single.client, single.state])
}

export type AgentBoardData = {
  worktrees: BoardWorktree[]
  repoIcons: Map<string, RepoIcon>
  repoBanners: Map<string, RepoBanner>
  refresh: () => Promise<void>
}

/** Repo icons are keyed per host: two hosts can hold projects of the same name. */
export function repoIconKey(hostId: string, repoName: string): string {
  return `${hostId} ${repoName}`
}

/** Banners key on the repo's own id, which is what a board card carries. */
export function repoBannerKey(hostId: string, repoId: string): string {
  return `${hostId} ${repoId}`
}

/**
 * Every covered host's workspaces, merged and kept live on the same refresh the
 * workspace list uses (poll while foregrounded + the host's own change events).
 */
export function useAgentBoardData(hosts: readonly AgentBoardHost[]): AgentBoardData {
  const [worktreesByHost, setWorktreesByHost] = useState<Map<string, BoardWorktree[]>>(new Map())
  const [repoIcons, setRepoIcons] = useState<Map<string, RepoIcon>>(new Map())
  const [repoBanners, setRepoBanners] = useState<Map<string, RepoBanner>>(new Map())

  const fetchHostWorktrees = useCallback(async (host: AgentBoardHost): Promise<void> => {
    const response = await host.client.sendRequest('worktree.ps', { limit: WORKTREE_PS_FULL_LIMIT })
    if (!response.ok) {
      return
    }
    const rows = (response.result as { worktrees?: BoardWorktree[] }).worktrees ?? []
    setCachedWorktrees(host.hostId, rows, { proven: true })
    setWorktreesByHost((previous) => {
      const next = new Map(previous)
      next.set(
        host.hostId,
        rows.map((row) => ({ ...row, boardHostId: host.hostId, boardHostName: host.name }))
      )
      return next
    })
  }, [])

  // Why: the project heading wears the repo's own icon and banner, as the
  // desktop column does, and only repo.list carries them.
  const fetchHostRepoIcons = useCallback(async (host: AgentBoardHost): Promise<void> => {
    const response = await host.client.sendRequest('repo.list')
    if (!response.ok) {
      return
    }
    const repos = (response.result as { repos?: RepoSummary[] }).repos ?? []
    setRepoIcons((previous) => {
      const next = new Map(previous)
      for (const repo of repos) {
        if (repo.repoIcon) {
          next.set(repoIconKey(host.hostId, repo.displayName), repo.repoIcon)
        }
      }
      return next
    })
    setRepoBanners((previous) => {
      const next = new Map(previous)
      for (const repo of repos) {
        const banner = sanitizeRepoBanner(repo.repoBanner)
        if (banner) {
          next.set(repoBannerKey(host.hostId, repo.id), banner)
        }
      }
      return next
    })
  }, [])

  const hostKey = hosts.map((host) => `${host.hostId}:${host.state}`).join(',')

  useEffect(() => {
    // Seed from the cache the home and host screens already filled, so the
    // board paints before any request settles.
    setWorktreesByHost((previous) => {
      const next = new Map(previous)
      for (const host of hosts) {
        if (next.has(host.hostId)) {
          continue
        }
        const cached = getCachedWorktrees(host.hostId) as BoardWorktree[] | null
        if (cached) {
          next.set(
            host.hostId,
            cached.map((row) => ({ ...row, boardHostId: host.hostId, boardHostName: host.name }))
          )
        }
      }
      return next
    })
    const stops = hosts.map((host) => {
      void fetchHostWorktrees(host)
      void fetchHostRepoIcons(host)
      return startHostWorktreeRefresh({
        client: host.client,
        fetchWorktrees: () => fetchHostWorktrees(host),
        fetchRepoMetadata: () => fetchHostRepoIcons(host)
      })
    })
    return () => {
      for (const stop of stops) {
        stop()
      }
    }
  }, [hostKey, hosts, fetchHostWorktrees, fetchHostRepoIcons])

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all(hosts.map((host) => fetchHostWorktrees(host)))
  }, [hosts, fetchHostWorktrees])

  const worktrees = useMemo(
    () => hosts.flatMap((host) => worktreesByHost.get(host.hostId) ?? []),
    [hosts, worktreesByHost]
  )

  return { worktrees, repoIcons, repoBanners, refresh }
}
