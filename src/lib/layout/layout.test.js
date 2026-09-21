import { describe, expect, it } from 'vitest'
import { computeGroupRects, isUnderNamespace, objectHeight, objectSize } from '@/lib/layout'
import { parseObjectFile } from '@/lib/model/parse'

const FILES = {
  'tiers.yaml': `name: tiers
attributes:
  - name: id
    type: string
`,
  'client.yaml': `name: client
attributes:
  - name: id_client
    type: string
groups:
  - name: identity
    attributes:
      - name: first_name
        type: string
      - name: full_name
        type: string
`,
}

function load() {
  return Object.entries(FILES).map(([fileName, text]) => parseObjectFile(fileName, text))
}

function object(id, namespace, x, y, width = 300, height = 120) {
  return { id, namespace, x, y, width, height }
}

describe('sizing', () => {
  it('sizes an object from its content', () => {
    const entries = load()
    const client = entries.find((entry) => entry.model.name === 'client').model
    const tiers = entries.find((entry) => entry.model.name === 'tiers').model
    expect(objectHeight(client)).toBeGreaterThan(objectHeight(tiers))
    expect(objectSize(client).width).toBe(300)
  })
})

describe('isUnderNamespace', () => {
  it('matches a namespace and its descendants', () => {
    expect(isUnderNamespace('a.b.c', 'a')).toBe(true)
    expect(isUnderNamespace('a', 'a')).toBe(true)
    expect(isUnderNamespace('ab', 'a')).toBe(false)
    expect(isUnderNamespace(null, 'a')).toBe(false)
    expect(isUnderNamespace('a', null)).toBe(false)
  })
})

describe('computeGroupRects', () => {
  it('wraps the objects of a namespace', () => {
    const rects = computeGroupRects([
      object('a.x', 'a', 100, 100),
      object('a.y', 'a', 100, 300),
    ])
    const a = rects.get('a')
    expect(a.x).toBeLessThan(100)
    expect(a.y).toBeLessThan(100)
    expect(a.width).toBeGreaterThan(300)
    expect(a.height).toBeGreaterThan(380)
  })

  it('nests sub-namespaces inside their parent', () => {
    const rects = computeGroupRects([object('a.b.z', 'a.b', 0, 0)])
    expect([...rects.keys()].sort()).toEqual(['a', 'a.b'])
    const parent = rects.get('a')
    const child = rects.get('a.b')
    expect(child.parent).toBe('a')
    expect(parent.x).toBeLessThanOrEqual(child.x)
    expect(parent.y).toBeLessThanOrEqual(child.y)
    expect(parent.x + parent.width).toBeGreaterThanOrEqual(child.x + child.width)
    expect(parent.y + parent.height).toBeGreaterThanOrEqual(child.y + child.height)
  })

  it('ignores objects without a namespace', () => {
    const rects = computeGroupRects([object('root', null, 0, 0)])
    expect(rects.size).toBe(0)
  })

  it('moves the frame when an object moves', () => {
    const before = computeGroupRects([object('a.x', 'a', 0, 0)]).get('a')
    const after = computeGroupRects([object('a.x', 'a', 500, 400)]).get('a')
    expect(after.x - before.x).toBe(500)
    expect(after.y - before.y).toBe(400)
  })
})
