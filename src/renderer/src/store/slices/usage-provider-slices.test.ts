import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * The provider usage slice copies snapshot fields into the store through a
 * hand-written list. A field added to the type but not the list type-checks,
 * fetches, and is then silently dropped on the way into state — which is
 * exactly how the per-project trend shipped invisible.
 */
describe('usage slice field list', () => {
  it('copies every field the usage data declares', () => {
    const source = readFileSync(new URL('./usage-provider-slices.ts', import.meta.url), 'utf8')
    const start = source.indexOf('type UsageData<')
    const block = source.slice(start, source.indexOf('\n}', start))
    const declared = block.matchAll(/^\s{2}(\w+):/gm)
    const copied = new Set(
      [
        ...(source.match(/const usageDataFields = \[[^\]]*\]/s)?.[0] ?? '').matchAll(/'(\w+)'/g)
      ].map((match) => match[1])
    )

    for (const [, field] of declared) {
      expect([field, copied.has(field)]).toEqual([field, true])
    }
  })
})
