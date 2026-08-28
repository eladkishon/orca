import { describe, expect, it } from 'vitest'
import { agentActivityKind, agentActivityTarget } from './agent-activity-kind'

describe('agentActivityKind', () => {
  it('names the kind of work behind a tool', () => {
    expect(agentActivityKind('Edit: src/app.tsx')).toBe('writing')
    expect(agentActivityKind('Read: src/app.tsx')).toBe('reading')
    expect(agentActivityKind('Grep: useEffect')).toBe('searching')
    expect(agentActivityKind('WebFetch: https://example.test')).toBe('browsing')
    expect(agentActivityKind('Task: review the diff')).toBe('delegating')
    expect(agentActivityKind('AskUserQuestion')).toBe('asking')
  })

  it('classifies the command, not just the shell', () => {
    // Nearly every agent funnels its real work through Bash, so "running a
    // command" would be true of half the board and worth nothing.
    expect(agentActivityKind('Bash: pnpm vitest run src/app.test.ts')).toBe('testing')
    expect(agentActivityKind('Bash: pnpm tsc --noEmit')).toBe('building')
    expect(agentActivityKind('Bash: git commit -m "wip"')).toBe('versioning')
    expect(agentActivityKind('Bash: curl https://example.test')).toBe('browsing')
    expect(agentActivityKind('Bash: rg useEffect src/')).toBe('searching')
  })

  it('names a toolchain whose own word contains the verb', () => {
    // The path guard that stops `src/build` matching also stops `build` inside
    // `xcodebuild`, which left a six-minute iOS build reading as "running".
    expect(agentActivityKind('Bash: xcodebuild -scheme wandr build')).toBe('building')
    expect(agentActivityKind('Bash: ./gradlew assembleDebug')).toBe('building')
    expect(agentActivityKind('Bash: xcodebuild -scheme wandr test')).toBe('testing')
  })

  it('falls back to running for a command it cannot place', () => {
    expect(agentActivityKind('Bash: ./deploy.sh')).toBe('running')
  })

  it('does not mistake a path, a hostname or a filename for the command', () => {
    // ".test" is a TLD, "src/build" is where it works, "app.test.ts" is a file.
    expect(agentActivityKind('Bash: curl https://example.test')).toBe('browsing')
    expect(agentActivityKind('Bash: cd src/build && ./run.sh')).toBe('running')
    expect(agentActivityKind('Read: src/build/index.ts')).toBe('reading')
  })

  it('calls an unknown tool thinking rather than guessing', () => {
    expect(agentActivityKind('SomeNewTool: whatever')).toBe('thinking')
  })

  it('has nothing to say when no tool is running', () => {
    expect(agentActivityKind(undefined)).toBeUndefined()
    expect(agentActivityKind('  ')).toBeUndefined()
  })
})

describe('agentActivityTarget', () => {
  it('names the file a tool is working on, not its whole path', () => {
    expect(agentActivityTarget('Edit: src/components/ui/tooltip.tsx')).toBe('tooltip.tsx')
    expect(agentActivityTarget('Read: /Users/me/dev/app/index.ts')).toBe('index.ts')
  })

  it('names the host for a fetch', () => {
    expect(agentActivityTarget('WebFetch: https://docs.example.test/a/b?c=1')).toBe(
      'docs.example.test'
    )
  })

  it('walks past shell wrappers to the command that names the work', () => {
    // "cd x && pnpm vitest run" is about vitest, not about cd.
    expect(agentActivityTarget('Bash: cd /repo && pnpm vitest run src/app.test.ts')).toBe(
      'vitest run'
    )
    // An argument is usually a path; the badge wants the thing operated on.
    expect(agentActivityTarget('Bash: rm -rf "/var/folders/5q/T/orca-paste"')).toBe('rm orca-paste')
  })

  it('elides a target too long for a badge', () => {
    const target = agentActivityTarget(`Read: ${'a'.repeat(80)}.ts`)

    expect(target).toHaveLength(28)
    expect(target?.endsWith('\u2026')).toBe(true)
  })

  it('has nothing to name without an input', () => {
    expect(agentActivityTarget('AskUserQuestion')).toBeUndefined()
    expect(agentActivityTarget('Bash:   ')).toBeUndefined()
    expect(agentActivityTarget(undefined)).toBeUndefined()
  })
})

describe('agentActivityTarget platforms', () => {
  it('names the platform a build is aimed at', () => {
    // "Building" and "Building · iOS Simulator" answer different questions when
    // a six-minute xcodebuild is what you are looking at.
    expect(
      agentActivityTarget(
        "Bash: xcodebuild -scheme wandr -destination 'platform=iOS Simulator,id=90C687B2' build"
      )
    ).toBe('iOS Simulator')
    expect(agentActivityTarget('Bash: eas build --platform android')).toBe('android')
    expect(agentActivityTarget('Bash: xcodebuild -sdk iphoneos build')).toBe('iphoneos')
  })

  it('still names the command when no platform is given', () => {
    expect(agentActivityTarget('Bash: pnpm vitest run')).toBe('vitest run')
  })
})
