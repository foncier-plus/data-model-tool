import { describe, expect, it } from 'vitest'
import { forceLayout, objectHeight, objectSize, separateOverlaps } from '@/components/graph/layout'
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

function center(position, node) {
  return { x: position.x + node.width / 2, y: position.y + node.height / 2 }
}

function overlaps(positions, nodes, padding = 0) {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = center(positions.get(nodes[i].id), nodes[i])
      const b = center(positions.get(nodes[j].id), nodes[j])
      const overlapX = (nodes[i].width + nodes[j].width) / 2 + padding - Math.abs(a.x - b.x)
      const overlapY = (nodes[i].height + nodes[j].height) / 2 + padding - Math.abs(a.y - b.y)
      if (overlapX > 0 && overlapY > 0) return true
    }
  }
  return false
}

describe('graph layout', () => {
  it('sizes an object from its content', () => {
    const entries = load()
    const client = entries.find((entry) => entry.model.name === 'client').model
    const tiers = entries.find((entry) => entry.model.name === 'tiers').model
    expect(objectHeight(client)).toBeGreaterThan(objectHeight(tiers))
    expect(objectSize(client).width).toBe(300)
  })
})

describe('forceLayout', () => {
  const NODES = [
    { id: 'a', width: 300, height: 120 },
    { id: 'b', width: 300, height: 120 },
    { id: 'c', width: 300, height: 120 },
    { id: 'd', width: 300, height: 160 },
    { id: 'e', width: 300, height: 120 },
  ]
  const EDGES = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'c', target: 'd' },
    { source: 'd', target: 'e' },
  ]

  it('places every node without overlap', () => {
    const positions = forceLayout({ nodes: NODES, edges: EDGES })
    expect(positions.size).toBe(NODES.length)
    expect(overlaps(positions, NODES)).toBe(false)
  })

  it('is deterministic', () => {
    const first = forceLayout({ nodes: NODES, edges: EDGES })
    const second = forceLayout({ nodes: NODES, edges: EDGES })
    for (const node of NODES) {
      expect(second.get(node.id)).toEqual(first.get(node.id))
    }
  })

  it('places sources to the left of their targets', () => {
    const positions = forceLayout({ nodes: NODES, edges: EDGES })
    for (const edge of EDGES) {
      expect(positions.get(edge.source).x).toBeLessThan(positions.get(edge.target).x)
    }
  })

  it('lengthens links when the link distance grows', () => {
    const gap = (positions) => {
      let total = 0
      for (const edge of EDGES) {
        const source = NODES.find((node) => node.id === edge.source)
        const from = positions.get(edge.source).x + source.width
        const to = positions.get(edge.target).x
        total += to - from
      }
      return total / EDGES.length
    }
    const short = forceLayout({ nodes: NODES, edges: EDGES, options: { linkDistance: 20 } })
    const long = forceLayout({ nodes: NODES, edges: EDGES, options: { linkDistance: 200 } })
    expect(gap(long)).toBeGreaterThan(gap(short))
  })

  it('aligns linked objects on the same row by default', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, width: 300, height: 120 }))
    const edges = nodes.slice(1).map((node, index) => ({
      source: nodes[index].id,
      target: node.id,
    }))
    const positions = forceLayout({ nodes, edges })
    for (const edge of edges) {
      expect(Math.abs(positions.get(edge.target).y - positions.get(edge.source).y)).toBeLessThan(20)
    }
  })

  it('enforces the repulsion distance between rectangles', () => {
    const gap = (positions) => {
      let min = Infinity
      for (let i = 0; i < NODES.length; i += 1) {
        for (let j = i + 1; j < NODES.length; j += 1) {
          const a = center(positions.get(NODES[i].id), NODES[i])
          const b = center(positions.get(NODES[j].id), NODES[j])
          const gapX = Math.abs(a.x - b.x) - (NODES[i].width + NODES[j].width) / 2
          const gapY = Math.abs(a.y - b.y) - (NODES[i].height + NODES[j].height) / 2
          min = Math.min(min, Math.max(gapX, gapY))
        }
      }
      return min
    }
    const positions = forceLayout({ nodes: NODES, edges: EDGES, options: { repulsionDistance: 120 } })
    expect(gap(positions)).toBeGreaterThanOrEqual(119)
  })
})

describe('separateOverlaps', () => {
  it('pushes overlapping nodes apart and keeps fixed nodes', () => {
    const nodes = [
      { id: 'a', width: 300, height: 120 },
      { id: 'b', width: 300, height: 240 },
    ]
    const positions = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 40, y: 20 }],
    ])
    const next = separateOverlaps({ nodes, positions, fixed: new Set(['a']), padding: 20 })
    expect(next.get('a')).toEqual({ x: 0, y: 0 })
    expect(overlaps(next, nodes)).toBe(false)
  })

  it('leaves distant nodes untouched', () => {
    const nodes = [
      { id: 'a', width: 300, height: 120 },
      { id: 'b', width: 300, height: 120 },
    ]
    const positions = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 2000, y: 0 }],
    ])
    const next = separateOverlaps({ nodes, positions, padding: 20 })
    expect(next.get('b')).toEqual({ x: 2000, y: 0 })
  })

  it('does not push a node beyond the half-heights plus padding', () => {
    const nodes = [
      { id: 'a', width: 300, height: 1200 },
      { id: 'b', width: 300, height: 120 },
    ]
    const positions = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 0, y: 1400 }],
    ])
    const next = separateOverlaps({ nodes, positions, padding: 20 })
    expect(next.get('a')).toEqual({ x: 0, y: 0 })
    expect(next.get('b')).toEqual({ x: 0, y: 1400 })
  })
})
