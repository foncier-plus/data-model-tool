import { describe, expect, it } from 'vitest'
import { buildNodeSpecs } from '@/components/graph/buildNodeSpecs'

function specs(overrides = {}) {
  const visible = {
    objectNodes: [
      { id: 'a', namespace: null, fileName: 'a.yaml', model: { name: 'A', attributes: [] } },
      { id: 'b', namespace: null, fileName: 'b.yaml', model: { name: 'B', attributes: [] } },
    ],
    collapsedGroupIds: new Set(),
    visibleObjectIds: new Set(['a', 'b']),
    edges: [],
  }
  const positions = new Map([
    ['a', { x: 0, y: 0 }],
    ['b', { x: 0, y: 0 }],
  ])
  return buildNodeSpecs({
    previous: [],
    visible,
    groupRects: new Map(),
    namespaceCounts: new Map(),
    positions,
    internalIds: new Set(['a']),
    showParentObjects: false,
    selectedId: null,
    relatedObjects: new Set(),
    edgeMode: 'aggregated',
    revealRefs: new Set(),
    linkedRefs: new Set(),
    autoCollapse: true,
    attributeRelations: false,
    rootGroup: false,
    index: new Map(),
    toggleGroup: () => {},
    ...overrides,
  })
}

describe('buildNodeSpecs', () => {
  it('renders internal objects as entity nodes', () => {
    const result = specs()
    const a = result.find((node) => node.id === 'a')
    expect(a.type).toBe('entity')
    expect(a.data.qualifiedName).toBe('a')
  })

  it('condenses external objects as dependency nodes', () => {
    const result = specs()
    const b = result.find((node) => node.id === 'b')
    expect(b.type).toBe('dependency')
    expect(b.data.external).toBe(true)
  })

  it('expands external objects when showParentObjects is on', () => {
    const result = specs({ showParentObjects: true })
    expect(result.find((node) => node.id === 'b').type).toBe('entity')
  })
})
