import { describe, expect, it } from 'vitest'
import {
  addAttribute,
  addGroup,
  moveAttribute,
  removeAttribute,
  removeGroup,
  setAttributeField,
  setGroupField,
  setObjectField,
} from '@/lib/model/mutations'
import { parseObjectFile } from '@/lib/model/parse'
import { serializeObject } from '@/lib/model/serialize'

const SOURCE = `name: client
description: Person or company.

attributes:
  # primary key
  - name: id
    type: string
    description: Unique id.

groups:
  - name: identity
    attributes:
      - name: first_name
        type: string
`

const load = (text = SOURCE, fileName = 'client.yaml') => {
  const parsed = parseObjectFile(fileName, text)
  return { ...parsed.entries[0], docs: parsed.docs }
}

describe('yaml round trip', () => {
  it('parses the model and reads the attribute comment', () => {
    const { model } = load()
    expect(model.name).toBe('client')
    expect(model.attributes).toHaveLength(1)
    expect(model.attributes[0].comment).toBe('primary key')
    expect(model.groups[0].name).toBe('identity')
  })

  it('keeps comments when editing a scalar', () => {
    const { doc } = load()
    setAttributeField(doc, null, 0, 'description', 'Changed description')
    const output = serializeObject(doc)
    expect(output).toContain('# primary key')
    expect(output).toContain('Changed description')
  })

  it('marks an attribute optional via presence and removes it when mandatory again', () => {
    const { doc } = load()
    setAttributeField(doc, null, 0, 'optional', true)
    const output = serializeObject(doc)
    expect(output).toContain('presence: optional')
    expect(load(output).model.attributes[0].optional).toBe(true)

    setAttributeField(doc, null, 0, 'optional', false)
    expect(serializeObject(doc)).not.toContain('presence')
  })

  it('writes and reads back an example', () => {
    const { doc } = load()
    setAttributeField(doc, null, 0, 'example', 'C12345')
    const output = serializeObject(doc)
    expect(output).toContain('example: C12345')
    expect(load(output).model.attributes[0].example).toBe('C12345')
  })

  it('writes and reads back a multi-line comment', () => {
    const { doc } = load()
    setAttributeField(doc, null, 0, 'comment', 'line one\nline two')
    const { model } = load(serializeObject(doc))
    expect(model.attributes[0].comment).toBe('line one\nline two')
  })

  it('serializes origin as a flow sequence', () => {
    const { doc } = load()
    setAttributeField(doc, null, 0, 'origin', { from: ['tiers.id'], formula: 'tiers.id' })
    const output = serializeObject(doc)
    expect(output).toContain('from: [tiers.id]')
    expect(output).toContain('formula: tiers.id')
    const { model } = load(output)
    expect(model.attributes[0].origin).toEqual({ from: ['tiers.id'], formula: 'tiers.id' })
  })

  it('removes the origin when both from and formula are empty', () => {
    const { doc } = load()
    setAttributeField(doc, null, 0, 'origin', { from: ['tiers.id'], formula: 'x' })
    setAttributeField(doc, null, 0, 'origin', { from: [], formula: '' })
    expect(serializeObject(doc)).not.toContain('origin:')
  })

  it('adds and removes attributes', () => {
    const { doc } = load()
    const index = addAttribute(doc, null)
    expect(index).toBe(1)
    let { model } = load(serializeObject(doc))
    expect(model.attributes).toHaveLength(2)
    expect(model.attributes[1].name).toBe('new_attribute')

    removeAttribute(doc, null, 1)
    ;({ model } = load(serializeObject(doc)))
    expect(model.attributes).toHaveLength(1)
  })

  it('creates groups with attributes', () => {
    const { doc } = load('name: invoice\n')
    const groupIndex = addGroup(doc)
    const attributeIndex = addAttribute(doc, groupIndex)
    expect(attributeIndex).toBe(0)
    const { model } = load(serializeObject(doc), 'invoice.yaml')
    expect(model.groups[0].name).toBe('new_group')
    expect(model.groups[0].attributes[0].name).toBe('new_attribute')
  })

  it('removes empty sequences when the last item is deleted', () => {
    const { doc } = load('name: x\nattributes:\n  - name: only\n')
    removeAttribute(doc, null, 0)
    expect(serializeObject(doc)).not.toContain('attributes')
  })

  it('removes a group and its attributes', () => {
    const { doc } = load()
    removeGroup(doc, 0)
    const { model } = load(serializeObject(doc))
    expect(model.groups).toHaveLength(0)
  })

  it('writes object description and comment', () => {
    const { doc } = load()
    setObjectField(doc, 'description', 'New description')
    setObjectField(doc, 'comment', 'file header')
    const output = serializeObject(doc)
    expect(output.startsWith('# file header')).toBe(true)
    const { model } = load(output)
    expect(model.description).toBe('New description')
    expect(model.comment).toBe('file header')
  })

  it('moves an attribute into a group without renaming it', () => {
    const { doc } = load()
    moveAttribute(doc, null, 0, 0)
    const { model } = load(serializeObject(doc))
    expect(model.attributes).toHaveLength(0)
    expect(model.groups[0].attributes.map((attribute) => attribute.name)).toEqual([
      'first_name',
      'id',
    ])
    expect(model.groups[0].attributes[1].comment).toBe('primary key')
  })

  it('moves a grouped attribute back to the root', () => {
    const { doc } = load()
    moveAttribute(doc, 0, 0, null)
    const { model } = load(serializeObject(doc))
    expect(model.groups[0].attributes).toHaveLength(0)
    expect(model.attributes.map((attribute) => attribute.name)).toEqual(['id', 'first_name'])
  })

  it('writes group comment and origin', () => {
    const { doc } = load()
    setGroupField(doc, 0, 'comment', 'group note')
    setGroupField(doc, 0, 'origin', { from: ['client.id'], formula: 'id' })
    const { model } = load(serializeObject(doc))
    expect(model.groups[0].comment).toBe('group note')
    expect(model.groups[0].origin).toEqual({ from: ['client.id'], formula: 'id' })
  })
})
