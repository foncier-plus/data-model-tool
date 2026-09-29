import { describe, expect, it } from 'vitest'
import { prettifyFile } from '@/lib/model/prettify'

const INPUT = `name: bati
namespace: AZAE
about: '[[doc.md]]'
attributes:
  - name: a
    type: string
  - name: b
    type: string
groups:
  - name: g1
    attributes:
      - name: x
        type: string
      - name: y
        type: string
  - name: g2
    attributes:
      - name: z
---
namespace: AZAE
name: site
attributes:
  - name: id
`

describe('prettifyFile', () => {
  it('orders first-level keys (namespace before name, about before attributes)', () => {
    const lines = prettifyFile(INPUT).split('\n')
    const indexOf = (prefix) => lines.findIndex((line) => line.startsWith(prefix))
    expect(indexOf('namespace:')).toBeLessThan(indexOf('name:'))
    expect(indexOf('about:')).toBeLessThan(indexOf('attributes:'))
  })

  it('separates attributes and groups with blank lines', () => {
    const out = prettifyFile(INPUT)
    expect(out).toContain('  - name: a\n    type: string\n\n  - name: b')
    expect(out).toContain('      - name: x\n        type: string\n\n      - name: y')
    expect(out).toMatch(/type: string\n\n  - name: g2/)
  })

  it('does not add blank lines around the document separator', () => {
    const out = prettifyFile(INPUT)
    expect(out).toContain('\n---\n')
    expect(out).not.toContain('\n\n---\n')
    expect(out).not.toContain('\n---\n\n')
  })
})
