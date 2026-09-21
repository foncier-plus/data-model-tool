import { describe, expect, it } from 'vitest'
import { finishLayout, hierarchyLayout, objectHeight, objectSize } from '@/lib/layout'
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

function overlaps(positions, units, padding = 0) {
  for (let i = 0; i < units.length; i += 1) {
    for (let j = i + 1; j < units.length; j += 1) {
      const a = positions.get(units[i].id)
      const b = positions.get(units[j].id)
      const overlapX = Math.min(a.x + units[i].width, b.x + units[j].width) - Math.max(a.x, b.x)
      const overlapY = Math.min(a.y + units[i].height, b.y + units[j].height) - Math.max(a.y, b.y)
      if (overlapX > padding && overlapY > padding) return true
    }
  }
  return false
}

function objectUnit(id, namespace, width = 300, height = 120) {
  return { id, namespace, kind: 'object', width, height }
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

describe('hierarchyLayout', () => {
  const UNITS = [
    objectUnit('a', null),
    objectUnit('b', null),
    objectUnit('c', null),
    objectUnit('d', null),
    objectUnit('e', null),
  ]
  const EDGES = [
    { id: 'a->b', source: 'a', target: 'b', count: 1 },
    { id: 'b->c', source: 'b', target: 'c', count: 1 },
    { id: 'c->d', source: 'c', target: 'd', count: 1 },
    { id: 'd->e', source: 'd', target: 'e', count: 1 },
  ]

  it('places every unit without overlap', () => {
    const { positions } = hierarchyLayout({ units: UNITS, edges: EDGES })
    expect(positions.size).toBe(UNITS.length)
    expect(overlaps(positions, UNITS)).toBe(false)
  })

  it('is deterministic for identical input', () => {
    const first = hierarchyLayout({ units: UNITS, edges: EDGES })
    const second = hierarchyLayout({ units: UNITS, edges: EDGES })
    for (const unit of UNITS) {
      expect(second.positions.get(unit.id)).toEqual(first.positions.get(unit.id))
    }
  })

  it('places sources to the left of their targets', () => {
    const { positions } = hierarchyLayout({ units: UNITS, edges: EDGES })
    for (const edge of EDGES) {
      expect(positions.get(edge.source).x).toBeLessThan(positions.get(edge.target).x)
    }
  })

  it('returns an empty layout for no units', () => {
    const layout = hierarchyLayout({ units: [], edges: [] })
    expect(layout.positions.size).toBe(0)
    expect(layout.groups).toEqual([])
  })
})

describe('namespace groups', () => {
  const UNITS = [
    objectUnit('a.x', 'a', 300, 100),
    objectUnit('a.y', 'a', 300, 100),
    objectUnit('a.b.z', 'a.b', 300, 100),
    objectUnit('c', null, 300, 100),
  ]
  const EDGES = [{ id: 'a.x->c', source: 'a.x', target: 'c', count: 1 }]

  it('groups objects by namespace and nests sub-namespaces', () => {
    const { groups, positions } = hierarchyLayout({ units: UNITS, edges: EDGES })
    const names = groups.map((group) => group.fullName).sort()
    expect(names).toEqual(['a', 'a.b'])

    const parent = groups.find((group) => group.fullName === 'a')
    const child = groups.find((group) => group.fullName === 'a.b')
    expect(child.parent).toBe('a')
    expect(parent.x).toBeLessThanOrEqual(child.x)
    expect(parent.y).toBeLessThanOrEqual(child.y)
    expect(parent.x + parent.width).toBeGreaterThanOrEqual(child.x + child.width)
    expect(parent.y + parent.height).toBeGreaterThanOrEqual(child.y + child.height)
    expect(positions.size).toBe(UNITS.length)
  })

  it('encloses every member object', () => {
    const { groups, positions } = hierarchyLayout({ units: UNITS, edges: EDGES })
    const parent = groups.find((group) => group.fullName === 'a')
    for (const unit of UNITS.filter((item) => item.id.startsWith('a'))) {
      const position = positions.get(unit.id)
      expect(parent.x).toBeLessThan(position.x)
      expect(parent.y).toBeLessThan(position.y)
      expect(parent.x + parent.width).toBeGreaterThan(position.x + unit.width)
      expect(parent.y + parent.height).toBeGreaterThan(position.y + unit.height)
    }
  })

  it('uses a fixed size for collapsed groups', () => {
    const units = [
      objectUnit('c', null, 300, 100),
      { id: 'ns:a', namespace: 'a', kind: 'collapsed', width: 220, height: 32 },
    ]
    const { groups, positions } = hierarchyLayout({
      units,
      edges: [],
      collapsed: new Set(['a']),
    })
    expect(groups).toEqual([])
    expect(positions.get('ns:a')).toBeTruthy()
    expect(overlaps(positions, units)).toBe(false)
  })
})

describe('stability', () => {
  it('keeps previous relative positions when they do not conflict', () => {
    const units = [objectUnit('a', null), objectUnit('b', null)]
    const initial = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 0, y: 200 }],
    ])
    const { positions } = hierarchyLayout({ units, edges: [], initial })
    expect(Math.abs(positions.get('b').y - positions.get('a').y - 200)).toBeLessThan(20)
  })
})

describe('larger graph', () => {
  it('lays out nested namespaces without overlap', () => {
    const units = []
    const edges = []
    const namespaces = ['sales', 'crm', 'finance']
    for (const namespace of namespaces) {
      for (let index = 0; index < 12; index += 1) {
        units.push(objectUnit(`${namespace}.o${index}`, namespace))
        if (index > 0) {
          edges.push({
            id: `${namespace}.o${index - 1}->${namespace}.o${index}`,
            source: `${namespace}.o${index - 1}`,
            target: `${namespace}.o${index}`,
            count: 1,
          })
        }
      }
    }
    edges.push({
      id: 'sales.o5->crm.o5',
      source: 'sales.o5',
      target: 'crm.o5',
      count: 1,
    })
    const { positions, groups } = hierarchyLayout({ units, edges })
    expect(positions.size).toBe(units.length)
    expect(groups.map((group) => group.fullName).sort()).toEqual([...namespaces].sort())
    expect(overlaps(positions, units)).toBe(false)
  })
})

describe('finishLayout', () => {
  it('recomputes group bounds from global positions', () => {
    const units = [objectUnit('a.x', 'a', 300, 100), objectUnit('a.y', 'a', 300, 100)]
    const positions = new Map([
      ['a.x', { x: 100, y: 100 }],
      ['a.y', { x: 100, y: 240 }],
    ])
    const layout = finishLayout({ units, positions })
    const group = layout.groups.find((item) => item.fullName === 'a')
    expect(group.x).toBeLessThan(100)
    expect(group.y).toBeLessThan(100)
    expect(group.width).toBeGreaterThan(300)
    expect(group.height).toBeGreaterThan(240)
  })
})
