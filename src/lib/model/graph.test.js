import { describe, expect, it } from 'vitest'
import {
  buildAttributeEdges,
  buildObjectGraph,
  graphNeighbors,
  selectionObjectId,
} from '@/lib/model/graph'
import { parseObjectFile } from '@/lib/model/parse'
import { buildIndex } from '@/lib/model/refs'

const FILES = {
  'tiers.yaml': `name: tiers
attributes:
  - name: id
    type: string
`,
  'client.yaml': `name: client
attributes:
  - name: id_client
    origin:
      from: [tiers.id]
      formula: tiers.id
groups:
  - name: identity
    attributes:
      - name: first_name
        type: string
      - name: last_name
        type: string
      - name: full_name
        origin:
          from: [client.first_name, client.last_name]
          formula: first_name + last_name
`,
  'contract.yaml': `name: contract
groups:
  - name: parties
    attributes:
      - name: client_id
        origin:
          from: [client.id_client]
          formula: client_id
      - name: client_name
        origin:
          from: [client.full_name]
          formula: full_name
`,
}

function load() {
  return Object.entries(FILES).flatMap(([fileName, text]) => parseObjectFile(fileName, text).entries)
}

describe('object graph', () => {
  const entries = load()
  const index = buildIndex(entries)

  it('creates one node per object', () => {
    const graph = buildObjectGraph(entries, index)
    expect(graph.nodes.map((node) => node.id).sort()).toEqual(['client', 'contract', 'tiers'])
  })

  it('aggregates multiple attribute links into one object link', () => {
    const graph = buildObjectGraph(entries, index)
    const edge = graph.edges.find((item) => item.source === 'client' && item.target === 'contract')
    expect(edge).toBeTruthy()
    expect(edge.count).toBe(2)
    expect(
      graph.edges.filter((item) => item.source === 'client' && item.target === 'contract'),
    ).toHaveLength(1)
  })

  it('links tiers to client', () => {
    const graph = buildObjectGraph(entries, index)
    const edge = graph.edges.find((item) => item.source === 'tiers' && item.target === 'client')
    expect(edge.count).toBe(1)
  })

  it('maps any selection to its owning object', () => {
    expect(selectionObjectId({ kind: 'object', objectName: 'client' })).toBe('client')
    expect(
      selectionObjectId({
        kind: 'group',
        objectName: 'client',
        groupName: 'identity',
        ref: 'client.identity',
      }),
    ).toBe('client')
    expect(
      selectionObjectId({
        kind: 'attribute',
        objectName: 'client',
        groupName: 'identity',
        attributeName: 'full_name',
        ref: 'client.identity.full_name',
      }),
    ).toBe('client')
    expect(selectionObjectId(null)).toBeNull()
  })

  it('computes upstream and downstream neighbors', () => {
    const graph = buildObjectGraph(entries, index)
    const { upstream, downstream } = graphNeighbors(graph, 'contract')
    expect(upstream.has('client')).toBe(true)
    expect(downstream.size).toBe(0)

    const client = graphNeighbors(graph, 'client')
    expect(client.upstream.has('tiers')).toBe(true)
    expect(client.downstream.has('contract')).toBe(true)
  })

  it('links objects when the referenced attribute name is missing', () => {
    const entries = [
      ...parseObjectFile(
        'a.yaml',
        'namespace: NS1\nname: A\nattributes:\n  - name: x\n    origin:\n      from: [NS1.B.ghost]\n      formula: x\n',
      ).entries,
      ...parseObjectFile('b.yaml', 'namespace: NS1\nname: B\nattributes:\n  - name: real\n').entries,
    ]
    const index = buildIndex(entries)
    const graph = buildObjectGraph(entries, index)
    const edge = graph.edges.find((item) => item.source === 'NS1.B' && item.target === 'NS1.A')
    expect(edge).toBeTruthy()
  })

  it('builds one attribute edge per origin with handle ids', () => {
    const { edges } = buildAttributeEdges(entries, index)
    const ids = edges.map((edge) => edge.id)

    expect(ids).toContain('client.first_name->client.full_name')
    expect(ids).toContain('client.last_name->client.full_name')
    expect(ids).toContain('client.full_name->contract.client_name')
    expect(ids).toContain('tiers.id->client.id_client')

    const edge = edges.find((item) => item.id === 'client.full_name->contract.client_name')
    expect(edge.source).toBe('client')
    expect(edge.target).toBe('contract')
    expect(edge.sourceHandle).toBe('client.full_name')
    expect(edge.targetHandle).toBe('contract.client_name')
  })
})
