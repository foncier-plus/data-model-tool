import { describe, expect, it } from 'vitest'
import { headingSlugs, parseWikiLink, resolveWikiPath, slugify } from '@/lib/model/wiki'

describe('wiki links', () => {
  it('parses a link with a section', () => {
    expect(parseWikiLink('[[docs/guide.md#Mon Titre]]')).toEqual({
      raw: '[[docs/guide.md#Mon Titre]]',
      path: 'docs/guide.md',
      section: 'Mon Titre',
    })
  })

  it('parses a link without a section', () => {
    expect(parseWikiLink('[[guide.md]]')).toMatchObject({ path: 'guide.md', section: '' })
  })

  it('rejects invalid values', () => {
    expect(parseWikiLink('guide.md')).toBeNull()
    expect(parseWikiLink('')).toBeNull()
  })

  it('resolves paths relative to the carrying file', () => {
    expect(resolveWikiPath('model/client.yaml', '../docs/guide.md')).toBe('docs/guide.md')
    expect(resolveWikiPath('a/b/model.yaml', 'notes.md')).toBe('a/b/notes.md')
    expect(resolveWikiPath('model.yaml', '/root.md')).toBe('root.md')
  })

  it('slugifies headings like GitHub', () => {
    expect(slugify('Mon Titre')).toBe('mon-titre')
    expect(slugify('Étude & Références')).toBe('etude-references')
  })

  it('lists heading slugs of a markdown document', () => {
    const slugs = headingSlugs('# Titre\n\ntexte\n\n## Mon Titre\n### Sous-titre ##\n')
    expect(slugs.has('titre')).toBe(true)
    expect(slugs.has('mon-titre')).toBe(true)
    expect(slugs.has('sous-titre')).toBe(true)
    expect(slugs.has('absent')).toBe(false)
  })
})
