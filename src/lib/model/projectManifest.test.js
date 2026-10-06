import { describe, expect, it } from 'vitest'
import { parseProjectManifest, resolveProjectPatterns } from '@/lib/model/projectManifest'

const ENTRIES = [
  { qualifiedName: 'NS1.ObjectAlpha' },
  { qualifiedName: 'NS1.sub.ObjectBeta' },
  { qualifiedName: 'NS2.ObjectDelta' },
  { qualifiedName: 'sales' },
]

describe('parseProjectManifest', () => {
  it('reads title, description and patterns', () => {
    const manifest = parseProjectManifest(
      'm.project.yaml',
      'title: Modèle\ndescription: note\ninclude:\n  - NS1.*\nexclude:\n  - NS2.ObjectDelta\n',
    )
    expect(manifest.title).toBe('Modèle')
    expect(manifest.description).toBe('note')
    expect(manifest.include).toEqual(['NS1.*'])
    expect(manifest.exclude).toEqual(['NS2.ObjectDelta'])
    expect(manifest.errors).toEqual([])
  })

  it('reports a missing title', () => {
    const manifest = parseProjectManifest('m.project.yaml', 'include: []\n')
    expect(manifest.errors.map((error) => error.code)).toContain('titleRequired')
  })

  it('reports an invalid include field', () => {
    const manifest = parseProjectManifest('m.project.yaml', 'title: T\ninclude: NS1.*\n')
    expect(manifest.errors.map((error) => error.code)).toContain('includeInvalid')
  })

  it('reports yaml syntax errors', () => {
    const manifest = parseProjectManifest('m.project.yaml', 'title: "unterminated\n')
    expect(manifest.errors.some((error) => error.code === 'yaml')).toBe(true)
  })
})

describe('resolveProjectPatterns', () => {
  it('matches an exact object', () => {
    const { ids, errors } = resolveProjectPatterns(ENTRIES, ['NS2.ObjectDelta'])
    expect([...ids]).toEqual(['NS2.ObjectDelta'])
    expect(errors).toEqual([])
  })

  it('matches a namespace wildcard recursively', () => {
    const { ids } = resolveProjectPatterns(ENTRIES, ['NS1.*'])
    expect([...ids].sort()).toEqual(['NS1.ObjectAlpha', 'NS1.sub.ObjectBeta'])
  })

  it('applies exclusions after inclusions', () => {
    const { ids } = resolveProjectPatterns(ENTRIES, ['NS1.*'], ['NS1.ObjectAlpha'])
    expect([...ids]).toEqual(['NS1.sub.ObjectBeta'])
  })

  it('does not treat a bare namespace as a wildcard', () => {
    const { ids, errors } = resolveProjectPatterns(ENTRIES, ['NS1'])
    expect([...ids]).toEqual([])
    expect(errors.map((error) => error.code)).toContain('includeNoMatch')
  })

  it('matches a root object by name', () => {
    const { ids } = resolveProjectPatterns(ENTRIES, ['sales'])
    expect([...ids]).toEqual(['sales'])
  })

  it('reports unmatched include and exclude patterns', () => {
    const { errors } = resolveProjectPatterns(ENTRIES, ['missing.*'], ['NS2.ghost'])
    const codes = errors.map((error) => error.code)
    expect(codes).toContain('includeNoMatch')
    expect(codes).toContain('excludeNoMatch')
  })
})
