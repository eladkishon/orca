import { describe, expect, it } from 'vitest'
import { buildRepoBannerPrompt, truncateReadmeExcerpt } from './repo-banner-ai-prompt'

describe('buildRepoBannerPrompt', () => {
  it('names the project and asks for a text-free, logo-free banner', () => {
    const prompt = buildRepoBannerPrompt({ repoName: 'orca', hasReferenceImages: false })
    expect(prompt).toContain('"orca"')
    expect(prompt).toContain('no text, no logos')
  })

  it('folds in the README excerpt when present', () => {
    const prompt = buildRepoBannerPrompt({
      repoName: 'orca',
      readmeExcerpt: 'An agentic coding IDE.',
      hasReferenceImages: false
    })
    expect(prompt).toContain('An agentic coding IDE.')
  })

  it('mentions reference images only when supplied', () => {
    const withRefs = buildRepoBannerPrompt({ repoName: 'orca', hasReferenceImages: true })
    const withoutRefs = buildRepoBannerPrompt({ repoName: 'orca', hasReferenceImages: false })
    expect(withRefs).toContain('Reference images')
    expect(withoutRefs).not.toContain('Reference images')
  })
})

describe('truncateReadmeExcerpt', () => {
  it('passes short text through unchanged', () => {
    expect(truncateReadmeExcerpt('  Short project.  ')).toBe('Short project.')
  })

  it('truncates long text with an ellipsis', () => {
    const long = 'a'.repeat(600)
    const result = truncateReadmeExcerpt(long)
    expect(result.length).toBe(501)
    expect(result.endsWith('…')).toBe(true)
  })
})
