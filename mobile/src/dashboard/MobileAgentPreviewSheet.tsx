import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { X } from 'lucide-react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import { MobileAgentIcon } from '../components/MobileAgentIcon'
import { colors, radii, spacing } from '../theme/mobile-theme'
import { TerminalWebView } from '../terminal/TerminalWebView'
import type { TerminalWebViewHandle } from '../terminal/terminal-webview-contract'
import { useHostClient } from '../transport/client-context'
import { agentIdentityLabel, agentStateLabel } from '../worktree/agent-row-display'
import type { DashboardAgentCard } from './agent-dashboard-board'
import {
  applyPreviewTerminalEvent,
  pickAgentTerminalTab,
  type PreviewSessionTab
} from './agent-terminal-preview'

/**
 * A tapped card's agent, live — the desktop board's AgentTerminalDialog.
 *
 * Read-only on purpose: the preview answers "what is it doing" without leaving
 * the board, and the subscription carries no client id or viewport, so watching
 * from a phone never re-fits the PTY the desktop pane is drawing.
 */
export function MobileAgentPreviewSheet({
  card,
  onClose,
  onOpenSession
}: {
  card: DashboardAgentCard | null
  onClose: () => void
  onOpenSession: (card: DashboardAgentCard) => void
}) {
  const { client } = useHostClient(card?.hostId)
  const terminalRef = useRef<TerminalWebViewHandle | null>(null)
  const [webReady, setWebReady] = useState(false)
  const [tab, setTab] = useState<PreviewSessionTab | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // The confirm IS the button, as on desktop: one tap arms, the next ends it.
  const [endArmed, setEndArmed] = useState(false)
  const worktreeId = card?.worktreeId
  const agentPaneKey = card?.agentPaneKey

  useEffect(() => {
    setWebReady(false)
    setTab(null)
    setNotice(null)
    setEndArmed(false)
  }, [card?.paneKey])

  useEffect(() => {
    if (!client || !worktreeId) {
      return
    }
    let disposed = false
    void client
      .sendRequest('session.tabs.list', { worktree: `id:${worktreeId}` })
      .then((response) => {
        if (disposed) {
          return
        }
        const tabs = response.ok
          ? ((response.result as { tabs?: PreviewSessionTab[] }).tabs ?? [])
          : []
        const picked = pickAgentTerminalTab(tabs, agentPaneKey)
        setTab(picked)
        setNotice(picked ? null : "No live terminal — this agent's pane has closed.")
      })
    return () => {
      disposed = true
    }
  }, [client, worktreeId, agentPaneKey])

  const handle = typeof tab?.terminal === 'string' ? tab.terminal : null

  useEffect(() => {
    if (!client || !handle || !webReady) {
      return
    }
    let stopped = false
    const unsubscribe = client.subscribe('terminal.subscribe', { terminal: handle }, (result) => {
      const sink = terminalRef.current
      if (stopped || !sink) {
        return
      }
      // A pane whose PTY is gone answers with `end` and nothing to draw.
      if ((result as { type?: unknown }).type === 'end') {
        setNotice("No live terminal — this agent's pane has closed.")
        return
      }
      applyPreviewTerminalEvent(result as Record<string, unknown>, {
        init: (cols, rows, initialData) => sink.init(cols, rows, initialData),
        write: (chunk) => sink.write(chunk)
      })
    })
    return () => {
      stopped = true
      unsubscribe()
    }
  }, [client, handle, webReady])

  const openSession = useCallback(() => {
    if (card) {
      onOpenSession(card)
    }
  }, [card, onOpenSession])

  // Ends the agent's session by closing its tab; the workspace is untouched.
  const endSession = useCallback(() => {
    if (!endArmed) {
      setEndArmed(true)
      return
    }
    setEndArmed(false)
    if (!client || !worktreeId || !tab?.id) {
      return
    }
    void client.sendRequest('session.tabs.close', {
      worktree: `id:${worktreeId}`,
      tabId: tab.id,
      reason: 'user'
    })
    onClose()
  }, [client, endArmed, onClose, tab?.id, worktreeId])

  return (
    <BottomDrawer
      visible={card !== null}
      onClose={onClose}
      fillAvailable
      contentScrollable={false}
      dragContentToDismiss={false}
    >
      {card ? (
        <View style={styles.sheet}>
          <View style={styles.header}>
            {card.agentType ? <MobileAgentIcon agentId={card.agentType} size={14} /> : null}
            <Text style={styles.title} numberOfLines={1}>
              {card.heading}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {agentIdentityLabel(card.agentType) || 'Agent'} · {agentStateLabel(card.dotState)}
          </Text>
          <View style={styles.terminal}>
            {handle && !notice ? (
              <TerminalWebView
                key={card.paneKey}
                ref={(ref) => {
                  terminalRef.current = ref
                }}
                style={styles.terminalView}
                onWebReady={() => setWebReady(true)}
              />
            ) : (
              <Text style={styles.notice}>{notice ?? 'Loading…'}</Text>
            )}
          </View>
          <View style={styles.actions}>
            <Pressable
              style={[styles.endButton, endArmed && styles.endButtonArmed]}
              onPress={endSession}
              onBlur={() => setEndArmed(false)}
              disabled={!tab?.id}
              accessibilityRole="button"
              accessibilityLabel={endArmed ? 'Confirm ending this session' : 'End session'}
            >
              <Text style={[styles.endButtonText, endArmed && styles.endButtonTextArmed]}>
                {endArmed ? 'End?' : 'End session'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.openButton}
              onPress={openSession}
              accessibilityRole="button"
              accessibilityLabel="Open session"
            >
              <Text style={styles.openButtonText}>Open session</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </BottomDrawer>
  )
}

const styles = StyleSheet.create({
  sheet: { flex: 1, gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  subtitle: { fontSize: 11, color: colors.textMuted },
  terminal: {
    flex: 1,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.terminalBg
  },
  terminalView: { flex: 1 },
  notice: { padding: spacing.md, fontSize: 12, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: spacing.sm },
  endButton: {
    alignItems: 'center',
    borderRadius: radii.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  endButtonArmed: { backgroundColor: colors.statusRed, borderColor: colors.statusRed },
  endButtonText: { fontSize: 13, color: colors.textSecondary },
  endButtonTextArmed: { color: colors.onAccent, fontWeight: '600' },
  openButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.button,
    backgroundColor: colors.bgRaised,
    paddingVertical: spacing.sm
  },
  openButtonText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary }
})
