import { describe, expect, it } from 'vitest'
import { parseObjectFile } from '@/lib/model/parse'
import {
  attributeRef,
  buildIndex,
  findObjectConflicts,
  groupRef,
  objectElements,
  resolveRef,
  validateReferences,
} from '@/lib/model/refs'

function load(files) {
  return Object.entries(files).flatMap(([fileName, text]) => parseObjectFile(fileName, text).entries)
}

function entry(_fileName, text) {
  return parseObjectFile('file.yaml', text).entries[0]
}

const TIERS = `name: tiers
attributes:
  - name: id
    type: string
`

const CLIENT = `name: client
attributes:
  - name: id_client
    type: string
    origin:
      from: [tiers.id]
      formula: tiers.id
groups:
  - name: identity
    attributes:
      - name: full_name
        origin:
          from: [client.first_name]
          formula: first_name
      - name: first_name
        type: string
`

describe('reference index', () => {
  it('indexes objects, groups and attributes', () => {
    const index = buildIndex(load({ 'client.yaml': CLIENT }))
    expect(resolveRef('client', index)?.kind).toBe('object')
    expect(resolveRef('client.identity', index)?.kind).toBe('group')
    expect(resolveRef('client.full_name', index)?.kind).toBe('attribute')
    expect(resolveRef('client.unknown', index)).toBeNull()
  })

  it('finds no issue on a valid model', () => {
    const issues = validateReferences(load({ 'tiers.yaml': TIERS, 'client.yaml': CLIENT }))
    expect(issues).toEqual([])
  })

  it('reports unresolved references', () => {
    const issues = validateReferences(load({ 'client.yaml': CLIENT }))
    expect(issues.some((issue) => issue.code === 'unresolved' && issue.from === 'tiers.id')).toBe(
      true,
    )
  })

  it('reports duplicate attributes', () => {
    const duplicate = `name: dup
attributes:
  - name: a
  - name: a
`
    const issues = validateReferences(load({ 'dup.yaml': duplicate }))
    expect(issues.some((issue) => issue.code === 'duplicate')).toBe(true)
  })

  it('reports self references', () => {
    const self = `name: self
attributes:
  - name: a
    origin:
      from: [self.a]
      formula: a
`
    const issues = validateReferences(load({ 'self.yaml': self }))
    expect(issues.some((issue) => issue.code === 'self')).toBe(true)
  })

  it('detects cycles', () => {
    const cycle = `name: loop
attributes:
  - name: a
    origin:
      from: [loop.b]
      formula: b
  - name: b
    origin:
      from: [loop.a]
      formula: a
`
    const issues = validateReferences(load({ 'loop.yaml': cycle }))
    expect(issues.some((issue) => issue.code === 'cycle')).toBe(true)
  })

  it('resolves a bare reference inside the file namespace', () => {
    const entries = [
      entry('sales/tiers.yaml', 'namespace: sales\nname: tiers\nattributes:\n  - name: id\n    type: string\n'),
      entry(
        'sales/client.yaml',
        'namespace: sales\nname: client\nattributes:\n  - name: id_client\n    origin:\n      from: [tiers.id]\n      formula: tiers.id\n',
      ),
    ]
    expect(validateReferences(entries)).toEqual([])
  })

  it('lists the elements of an object for origin autocomplete', () => {
    const model = load({ 'client.yaml': CLIENT })[0].model
    expect(objectElements(model)).toEqual([
      'id_client',
      'identity',
      'full_name',
      'first_name',
    ])
  })

  it('builds canonical refs', () => {
    expect(attributeRef('client', null, 'id')).toBe('client.id')
    expect(attributeRef('client', 'identity', 'id')).toBe('client.id')
    expect(groupRef('client', 'identity')).toBe('client.identity')
  })

  it('does not resolve references across projects', () => {
    const entries = [
      entry('sales/tiers.yaml', 'namespace: sales\nname: tiers\nattributes:\n  - name: id\n    type: string\n'),
      entry(
        'crm/client.yaml',
        'namespace: crm\nname: client\nattributes:\n  - name: id\n    origin:\n      from: [tiers.id]\n      formula: tiers.id\n',
      ),
    ]
    const issues = validateReferences(entries)
    expect(issues.some((issue) => issue.code === 'unresolved' && issue.from === 'tiers.id')).toBe(
      true,
    )
  })

  it('resolves references within a project whose name contains spaces', () => {
    const entries = [
      entry(
        'Mon Projet/tiers.yaml',
        'namespace: Mon Projet\nname: tiers\nattributes:\n  - name: id\n    type: string\n',
      ),
      entry(
        'Mon Projet/client.yaml',
        'namespace: Mon Projet\nname: client\nattributes:\n  - name: id\n    origin:\n      from: [tiers.id]\n      formula: tiers.id\n',
      ),
    ]
    expect(validateReferences(entries)).toEqual([])
  })

  it('resolves a fully-qualified reference to another project', () => {
    const entries = [
      entry(
        'ign.yaml',
        'namespace: IGN.BDTOPO\nname: batiment\nattributes:\n  - name: hauteur\n    type: number\n',
      ),
      entry(
        'azae.yaml',
        'namespace: AZAE\nname: bati\nattributes:\n  - name: hauteur\n    type: number\n    origin:\n      from: [IGN.BDTOPO.batiment.hauteur]\n      formula: hauteur\n',
      ),
    ]
    expect(validateReferences(entries)).toEqual([])
  })

  it('reports objects declared in several files as conflicts', () => {
    const entries = [
      ...parseObjectFile('a.yaml', 'namespace: AZAE\nname: bati\nattributes:\n  - name: x\n').entries,
      ...parseObjectFile('b.yaml', 'namespace: AZAE\nname: bati\nattributes:\n  - name: y\n').entries,
    ]
    const conflicts = findObjectConflicts(entries)
    expect([...conflicts.keys()]).toEqual(['AZAE.bati'])
    expect(conflicts.get('AZAE.bati').sort()).toEqual(['a.yaml', 'b.yaml'])
    expect(validateReferences(entries).some((issue) => issue.code === 'conflict')).toBe(true)
  })

  it('resolves a project-relative reference to another sub-namespace', () => {
    const entries = [
      entry(
        'proj/ref/tiers.yaml',
        'namespace: proj.ref\nname: tiers\nattributes:\n  - name: id\n    type: string\n',
      ),
      entry(
        'proj/app/client.yaml',
        'namespace: proj.app\nname: client\nattributes:\n  - name: id\n    origin:\n      from: [ref.tiers.id]\n      formula: ref.tiers.id\n',
      ),
    ]
    expect(validateReferences(entries)).toEqual([])
  })
})
