import {
  Braces,
  Compass,
  FlaskConical,
  Globe,
  Hammer,
  ListTodo,
  MessageCircleQuestion,
  Search,
  Sparkles,
  Terminal,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import {
  agentActivityKind,
  agentActivityTarget,
  type AgentActivityKind
} from './agent-activity-kind'

/**
 * What kind of work the agent is doing, said in words, at the top of its card.
 *
 * The command chip below already says the literal command; this says what that
 * command IS, and what it is for. Scanning a board for "who is testing" should
 * not require reading a dozen shell invocations — and a board where every card
 * says "Running a command" has told you nothing, so the badge names the file,
 * host or command that the work is about.
 */

type KindPresentation = { icon: typeof Braces; label: () => string; className: string }

const PRESENTATION: Readonly<Record<AgentActivityKind, KindPresentation>> = {
  writing: {
    icon: Braces,
    label: () => translate('dashboardPopout.activity.writing', 'Writing code'),
    className: 'bg-violet-500/12 text-violet-700 dark:text-violet-300'
  },
  testing: {
    icon: FlaskConical,
    label: () => translate('dashboardPopout.activity.testing', 'Testing'),
    className: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
  },
  building: {
    icon: Hammer,
    label: () => translate('dashboardPopout.activity.building', 'Building'),
    className: 'bg-orange-500/12 text-orange-700 dark:text-orange-300'
  },
  versioning: {
    icon: Compass,
    label: () => translate('dashboardPopout.activity.versioning', 'Git'),
    className: 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
  },
  reading: {
    icon: Search,
    label: () => translate('dashboardPopout.activity.reading', 'Reading code'),
    className: 'bg-sky-500/12 text-sky-700 dark:text-sky-300'
  },
  searching: {
    icon: Search,
    label: () => translate('dashboardPopout.activity.searching', 'Searching'),
    className: 'bg-sky-500/12 text-sky-700 dark:text-sky-300'
  },
  browsing: {
    icon: Globe,
    label: () => translate('dashboardPopout.activity.browsing', 'Fetching online'),
    className: 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300'
  },
  running: {
    icon: Terminal,
    label: () => translate('dashboardPopout.activity.running', 'Running a command'),
    className: 'bg-muted-foreground/12 text-muted-foreground'
  },
  planning: {
    icon: ListTodo,
    label: () => translate('dashboardPopout.activity.planning', 'Planning'),
    className: 'bg-muted-foreground/12 text-muted-foreground'
  },
  delegating: {
    icon: Users,
    label: () => translate('dashboardPopout.activity.delegating', 'Delegating'),
    className: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300'
  },
  asking: {
    icon: MessageCircleQuestion,
    label: () => translate('dashboardPopout.activity.asking', 'Asking you'),
    className: 'bg-agent-question/15 text-agent-question-text'
  },
  thinking: {
    icon: Sparkles,
    label: () => translate('dashboardPopout.activity.thinking', 'Thinking'),
    className: 'bg-muted-foreground/12 text-muted-foreground'
  }
}

export function AgentActivityBadge({
  activity
}: {
  activity: string | undefined
}): React.JSX.Element | null {
  const kind = agentActivityKind(activity)
  if (!kind) {
    return null
  }
  const { icon: Icon, label, className } = PRESENTATION[kind]
  const target = agentActivityTarget(activity)
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.01em]',
        className
      )}
    >
      <Icon className="size-2.5" aria-hidden />
      {label()}
      {target ? (
        <>
          <span aria-hidden className="opacity-40">
            ·
          </span>
          <span className="max-w-[14rem] truncate font-mono font-normal opacity-90">{target}</span>
        </>
      ) : null}
    </span>
  )
}
