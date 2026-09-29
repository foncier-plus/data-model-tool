import { describe, expect, it } from 'vitest'
import { parseObjectFile } from '@/lib/model/parse'
import { setAttributeField } from '@/lib/model/mutations'
import { serializeObject } from '@/lib/model/serialize'

function parse(text) {
  return parseObjectFile('client.yaml', text).entries[0]
}

describe('attribute presence', () => {
  it('reads presence: optional', () => {
    const { model } = parse('name: c\nattributes:\n  - name: id\n    presence: optional\n')
    expect(model.attributes[0].optional).toBe(true)
    expect(model.attributes[0].presence).toBe('optional')
  })

  it('treats presence: mandatory as required', () => {
    const { model } = parse('name: c\nattributes:\n  - name: id\n    presence: mandatory\n')
    expect(model.attributes[0].optional).toBe(false)
  })

  it('still supports the legacy optional: true flag', () => {
    const { model } = parse('name: c\nattributes:\n  - name: id\n    optional: true\n')
    expect(model.attributes[0].optional).toBe(true)
  })
})

describe('attribute example', () => {
  it('exposes a numeric example as text so it can be cleared', () => {
    const { model } = parse(`name: client
attributes:
  - name: id
    type: string
    example: 123
`)
    expect(model.attributes[0].example).toBe('123')
  })

  it('removes the example property when cleared', () => {
    const { doc } = parse(`name: client
attributes:
  - name: id
    type: string
    example: ABC
`)
    setAttributeField(doc, null, 0, 'example', '')
    expect(serializeObject(doc)).not.toContain('example')
  })

  it('removes a numeric example property when cleared', () => {
    const { doc } = parse(`name: client
attributes:
  - name: id
    type: string
    example: 123
`)
    setAttributeField(doc, null, 0, 'example', '')
    expect(serializeObject(doc)).not.toContain('example')
  })

  it('removes an empty example key when cleared', () => {
    const { doc } = parse(`name: client
attributes:
  - name: id
    type: string
    example:
`)
    setAttributeField(doc, null, 0, 'example', '')
    expect(serializeObject(doc)).not.toContain('example')
  })
})
