import { describe, expect, it } from 'vitest'
import { entryIdentity, normalizeNamespace, parseObjectFile } from '@/lib/model/parse'
import { blankObjectFile, serializeObjects } from '@/lib/model/serialize'

const MULTI = `namespace: sales
name: client
description: Client
about: '[[docs/client.md#identite]]'
attributes:
  - name: id
    type: string
---
namespace: sales
name: order
attributes:
  - name: client_id
    origin:
      from: [client.id]
      formula: client.id
---
name: root_object
attributes:
  - name: id
`

describe('multi-document YAML files', () => {
  it('parses one entry per document with its namespace', () => {
    const { entries, docs } = parseObjectFile('model.yaml', MULTI)
    expect(docs).toHaveLength(3)
    expect(entries.map((entry) => entry.qualifiedName)).toEqual([
      'sales.client',
      'sales.order',
      'root_object',
    ])
    expect(entries[0].namespace).toBe('sales')
    expect(entries[2].namespace).toBeNull()
  })

  it('reads the about link on objects', () => {
    const { entries } = parseObjectFile('model.yaml', MULTI)
    expect(entries[0].model.about).toBe('[[docs/client.md#identite]]')
  })

  it('records source line numbers for objects, groups and attributes', () => {
    const text = `namespace: AZAE
name: bati
attributes:
  - name: hauteur
    type: number
  - name: annee
    type: string
groups:
  - name: données IGN
    attributes:
      - name: geometry
        type: string
`
    const entry = parseObjectFile('a.yaml', text).entries[0]
    expect(entry.lines.object).toBe(1)
    expect(entry.lines.attributes.hauteur).toBe(4)
    expect(entry.lines.attributes.annee).toBe(6)
    expect(entry.lines.groups['données IGN']).toBe(9)
    expect(entry.lines.groupAttributes['données IGN.geometry']).toBe(11)
  })

  it('normalizes namespaces and builds identities', () => {
    expect(normalizeNamespace(' sales . crm ')).toBe('sales.crm')
    expect(normalizeNamespace('..sales..')).toBe('sales')
    expect(normalizeNamespace('')).toBe('')
    expect(entryIdentity('sales.crm', 'client')).toBe('sales.crm.client')
    expect(entryIdentity('', 'client')).toBe('client')
  })

  it('quotes unsafe scalar values in blank files', () => {
    const content = blankObjectFile('mon objet', 'sales: crm')
    const parsed = parseObjectFile('x.yaml', content)
    expect(parsed.entries[0].model.name).toBe('mon objet')
    expect(parsed.entries[0].namespace).toBe('sales: crm')
  })

  it('round-trips all documents', () => {
    const { docs } = parseObjectFile('model.yaml', MULTI)
    const output = serializeObjects(docs)
    const reparsed = parseObjectFile('model.yaml', output)
    expect(reparsed.entries.map((entry) => entry.qualifiedName)).toEqual([
      'sales.client',
      'sales.order',
      'root_object',
    ])
  })
})
