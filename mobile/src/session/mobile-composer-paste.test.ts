import { describe, expect, it } from 'vitest'
import { insertComposerText } from './mobile-composer-paste'

describe('insertComposerText', () => {
  it('drops clipboard text at the caret', () => {
    expect(insertComposerText('fix ', 4, 'src/app.ts')).toEqual({
      text: 'fix src/app.ts',
      cursor: 14
    })
  })

  it('clamps a caret outside the draft', () => {
    expect(insertComposerText('ab', 99, 'c')).toEqual({ text: 'abc', cursor: 3 })
    expect(insertComposerText('ab', -1, 'c')).toEqual({ text: 'cab', cursor: 1 })
  })
})
