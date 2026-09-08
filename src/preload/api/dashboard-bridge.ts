import { ipcRenderer } from 'electron'
import type {
  DashboardCloseSessionArgs,
  DashboardCreateWorkspaceArgs,
  DashboardOpenFileArgs,
  DashboardRemoveWorkspaceArgs,
  DashboardRenameProjectArgs,
  DashboardRevealAgentArgs,
  DashboardSetProjectBannerArgs,
  DashboardSleepWorkspaceArgs,
  DashboardSnapshot,
  DashboardSpawnAgentArgs
} from '../../shared/dashboard-snapshot'
import type { PreloadApi } from '../api-types'

export const dashboardApi = {
  // Open the pop-out dashboard window, or focus it if already open.
  openPopout: (view?: 'board' | 'map'): Promise<void> =>
    ipcRenderer.invoke('dashboardPopout:open', view),

  // ── Producer side (main window) ──────────────────────────────────────
  publishSnapshot: (snapshot: DashboardSnapshot): Promise<void> =>
    ipcRenderer.invoke('dashboard:publishSnapshot', snapshot),
  getPopoutOpen: (): Promise<boolean> => ipcRenderer.invoke('dashboard:getPopoutOpen'),
  onPopoutOpenChanged: (callback: (open: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, open: boolean): void => callback(open)
    ipcRenderer.on('dashboard:popoutOpenChanged', listener)
    return () => ipcRenderer.removeListener('dashboard:popoutOpenChanged', listener)
  },
  onSnapshotRequested: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('dashboard:snapshotRequested', listener)
    return () => ipcRenderer.removeListener('dashboard:snapshotRequested', listener)
  },
  onRevealAgent: (callback: (args: DashboardRevealAgentArgs) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, args: DashboardRevealAgentArgs): void =>
      callback(args)
    ipcRenderer.on('ui:revealDashboardAgent', listener)
    return () => ipcRenderer.removeListener('ui:revealDashboardAgent', listener)
  },
  onAckAgent: (callback: (paneKey: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, paneKey: string): void => callback(paneKey)
    ipcRenderer.on('ui:ackDashboardAgent', listener)
    return () => ipcRenderer.removeListener('ui:ackDashboardAgent', listener)
  },
  onSpawnAgent: (callback: (args: DashboardSpawnAgentArgs) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, args: DashboardSpawnAgentArgs): void =>
      callback(args)
    ipcRenderer.on('ui:spawnDashboardAgent', listener)
    return () => ipcRenderer.removeListener('ui:spawnDashboardAgent', listener)
  },
  onSleepWorkspace: (callback: (args: DashboardSleepWorkspaceArgs) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, args: DashboardSleepWorkspaceArgs): void =>
      callback(args)
    ipcRenderer.on('ui:sleepDashboardWorkspace', listener)
    return () => ipcRenderer.removeListener('ui:sleepDashboardWorkspace', listener)
  },

  // ── Consumer side (pop-out window) ───────────────────────────────────
  requestSnapshot: (): Promise<void> => ipcRenderer.invoke('dashboard:requestSnapshot'),
  onSnapshot: (callback: (snapshot: DashboardSnapshot) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: DashboardSnapshot): void =>
      callback(snapshot)
    ipcRenderer.on('dashboard:snapshot', listener)
    return () => ipcRenderer.removeListener('dashboard:snapshot', listener)
  },
  onViewRequested: (callback: (view: 'board' | 'map') => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, view: 'board' | 'map'): void =>
      callback(view)
    ipcRenderer.on('dashboard:viewRequested', listener)
    return () => ipcRenderer.removeListener('dashboard:viewRequested', listener)
  },
  revealAgent: (args: DashboardRevealAgentArgs): Promise<void> =>
    ipcRenderer.invoke('dashboardPopout:revealAgent', args),
  ackAgent: (paneKey: string): Promise<void> =>
    ipcRenderer.invoke('dashboardPopout:ackAgent', { paneKey }),
  spawnAgent: (args: DashboardSpawnAgentArgs): Promise<void> =>
    ipcRenderer.invoke('dashboardPopout:spawnAgent', args),
  sleepWorkspace: (args: DashboardSleepWorkspaceArgs): Promise<void> =>
    ipcRenderer.invoke('dashboardPopout:sleepWorkspace', args),
  onCreateWorkspace: (callback: (args: DashboardCreateWorkspaceArgs) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, args: DashboardCreateWorkspaceArgs): void => callback(args)
    ipcRenderer.on('ui:createDashboardWorkspace', listener)
    return () => ipcRenderer.removeListener('ui:createDashboardWorkspace', listener)
  },
  onOpenFile: (callback: (args: DashboardOpenFileArgs) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, args: DashboardOpenFileArgs): void => callback(args)
    ipcRenderer.on('ui:openDashboardFile', listener)
    return () => ipcRenderer.removeListener('ui:openDashboardFile', listener)
  },
  onRemoveWorkspace: (callback: (args: DashboardRemoveWorkspaceArgs) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, args: DashboardRemoveWorkspaceArgs): void => callback(args)
    ipcRenderer.on('ui:removeDashboardWorkspace', listener)
    return () => ipcRenderer.removeListener('ui:removeDashboardWorkspace', listener)
  },
  onCloseSession: (callback: (args: DashboardCloseSessionArgs) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, args: DashboardCloseSessionArgs): void => callback(args)
    ipcRenderer.on('ui:closeDashboardSession', listener)
    return () => ipcRenderer.removeListener('ui:closeDashboardSession', listener)
  },
  onSetProjectBanner: (callback: (args: DashboardSetProjectBannerArgs) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, args: DashboardSetProjectBannerArgs): void => callback(args)
    ipcRenderer.on('ui:setDashboardProjectBanner', listener)
    return () => ipcRenderer.removeListener('ui:setDashboardProjectBanner', listener)
  },
  onRenameProject: (callback: (args: DashboardRenameProjectArgs) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, args: DashboardRenameProjectArgs): void => callback(args)
    ipcRenderer.on('ui:renameDashboardProject', listener)
    return () => ipcRenderer.removeListener('ui:renameDashboardProject', listener)
  },
  openFile: (args: DashboardOpenFileArgs): Promise<void> =>
    ipcRenderer.invoke('dashboardPopout:openFile', args),
  removeWorkspace: (args: DashboardRemoveWorkspaceArgs): Promise<void> =>
    ipcRenderer.invoke('dashboardPopout:removeWorkspace', args),
  closeSession: (args: DashboardCloseSessionArgs): Promise<void> =>
    ipcRenderer.invoke('dashboardPopout:closeSession', args),
  setProjectBanner: (args: DashboardSetProjectBannerArgs): Promise<void> =>
    ipcRenderer.invoke('dashboardPopout:setProjectBanner', args),
  renameProject: (args: DashboardRenameProjectArgs): Promise<void> =>
    ipcRenderer.invoke('dashboardPopout:renameProject', args),
  createWorkspace: (args: DashboardCreateWorkspaceArgs): Promise<void> =>
    ipcRenderer.invoke('dashboardPopout:createWorkspace', args)
} satisfies PreloadApi['dashboard']
