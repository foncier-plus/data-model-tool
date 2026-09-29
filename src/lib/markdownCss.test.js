import { describe, expect, it } from 'vitest'
import { scopeMarkdownCss } from '@/lib/markdownCss'

describe('scopeMarkdownCss', () => {
  it('wraps the css in a @scope limited to the markdown preview', () => {
    const scoped = scopeMarkdownCss('h1 { color: red; }')
    expect(scoped).toContain('@scope (.markdown-preview)')
    expect(scoped).toContain('h1 { color: red; }')
  })

  it('remaps :root to the markdown preview container', () => {
    const scoped = scopeMarkdownCss(':root { --accent: red; }')
    expect(scoped).toContain(':scope { --accent: red; }')
    expect(scoped).not.toContain(':root')
  })

  it('returns an empty string for empty input', () => {
    expect(scopeMarkdownCss('')).toBe('')
    expect(scopeMarkdownCss('   ')).toBe('')
    expect(scopeMarkdownCss(null)).toBe('')
  })
})
