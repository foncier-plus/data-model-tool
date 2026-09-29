import { describe, expect, it } from 'vitest'
import {
  computeGroupRects,
  isUnderNamespace,
  layoutGraph,
  layoutLevel,
  objectHeight,
  objectSize,
} from '@/lib/layout'
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
  return Object.entries(FILES).flatMap(([fileName, text]) => parseObjectFile(fileName, text).entries)
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
    expect(a.height).toBeGreaterThan(340)
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

describe('layoutLevel', () => {
  it('places dependencies in columns and stacks the rest', () => {
    const elements = [
      { id: 'a', width: 100, height: 50 },
      { id: 'b', width: 100, height: 50 },
      { id: 'c', width: 100, height: 50 },
    ]
    const positions = layoutLevel(elements, [{ source: 'a', target: 'b' }], 20)
    expect(positions.get('a').x).toBeLessThan(positions.get('b').x)
    expect(positions.get('c').x).toBe(positions.get('a').x)
    expect(positions.get('c').y).not.toBe(positions.get('a').y)
  })
})

describe('layoutGraph', () => {
  const size = (width = 300, height = 100) => ({ width, height })

  it('places dependent objects left to right', () => {
    const units = [
      { id: 'tiers', namespace: null, kind: 'object' },
      { id: 'client', namespace: null, kind: 'object' },
    ]
    const sizes = new Map([
      ['tiers', size()],
      ['client', size(300, 120)],
    ])
    const { positions } = layoutGraph({
      units,
      edges: [{ source: 'tiers', target: 'client' }],
      collapsed: new Set(),
      sizes,
      columnGap: 80,
    })
    expect(positions.get('tiers').x).toBeLessThan(positions.get('client').x)
  })

  it('stacks independent objects vertically', () => {
    const units = [
      { id: 'a', namespace: null, kind: 'object' },
      { id: 'b', namespace: null, kind: 'object' },
    ]
    const sizes = new Map([
      ['a', size()],
      ['b', size()],
    ])
    const { positions } = layoutGraph({
      units,
      edges: [],
      collapsed: new Set(),
      sizes,
      columnGap: 80,
    })
    expect(positions.get('a').x).toBe(positions.get('b').x)
    expect(positions.get('a').y).not.toBe(positions.get('b').y)
  })

  it('aggregates a group dependencies from its members', () => {
    const units = [
      { id: 'a.x', namespace: 'a', kind: 'object' },
      { id: 'b.y', namespace: 'b', kind: 'object' },
    ]
    const sizes = new Map([
      ['a.x', size()],
      ['b.y', size()],
    ])
    const { groups } = layoutGraph({
      units,
      edges: [{ source: 'a.x', target: 'b.y' }],
      collapsed: new Set(),
      sizes,
      columnGap: 80,
    })
    expect(groups.get('a').x).toBeLessThan(groups.get('b').x)
  })
})
