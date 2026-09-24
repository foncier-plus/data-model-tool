import { describe, expect, it } from 'vitest'
import {
  buildNamespaceTree,
  buildVisibleGraph,
  filterObjectIds,
  namespaceParent,
  namespacePrefixes,
  nearestCollapsedAncestor,
  nearestExpandedNamespace,
  proxyId,
  subtreeObjectIds,
} from '@/lib/model/hierarchy'

const GRAPH = {
  nodes: [
    { id: 'a.x', namespace: 'a' },
    { id: 'a.y', namespace: 'a' },
    { id: 'a.b.z', namespace: 'a.b' },
    { id: 'c', namespace: null },
  ],
  edges: [
    { id: 'e1', source: 'a.x', target: 'c', count: 1, details: [] },
    { id: 'e2', source: 'a.y', target: 'c', count: 1, details: [] },
    { id: 'e3', source: 'a.b.z', target: 'a.x', count: 1, details: [] },
  ],
}

describe('namespace helpers', () => {
  it('splits namespaces into prefixes and parents', () => {
    expect(namespacePrefixes('a.b.c')).toEqual(['a', 'a.b', 'a.b.c'])
    expect(namespaceParent('a.b.c')).toBe('a.b')
    expect(namespaceParent('a')).toBeNull()
  })

  it('finds the nearest collapsed ancestor', () => {
    expect(nearestCollapsedAncestor('a.b.c', new Set(['a']))).toBe('a')
    expect(nearestCollapsedAncestor('a.b.c', new Set(['a.b']))).toBe('a.b')
    expect(nearestCollapsedAncestor('a.b.c', new Set())).toBeNull()
    expect(nearestCollapsedAncestor(null, new Set(['a']))).toBeNull()
  })

  it('finds the nearest expanded namespace', () => {
    expect(nearestExpandedNamespace('a.b.c', new Set())).toBe('a.b.c')
    expect(nearestExpandedNamespace('a.b.c', new Set(['a.b']))).toBe('a')
    expect(nearestExpandedNamespace('a.b', new Set(['a.b']))).toBe('a')
    expect(nearestExpandedNamespace('a', new Set(['a']))).toBeNull()
  })

  it('maps an object to its link proxy', () => {
    expect(proxyId('a.x', 'a', new Set())).toBe('a.x')
    expect(proxyId('a.b.z', 'a.b', new Set(['a']))).toBe('ns:a')
    expect(proxyId('a.b.z', 'a.b', new Set(['a.b']))).toBe('ns:a.b')
  })
})

describe('buildVisibleGraph', () => {
  it('keeps every object and edge when nothing is collapsed', () => {
    const { objectNodes, collapsedGroupIds, edges } = buildVisibleGraph(GRAPH, new Set(), null)
    expect(objectNodes.map((node) => node.id).sort()).toEqual(['a.b.z', 'a.x', 'a.y', 'c'])
    expect(collapsedGroupIds.size).toBe(0)
    expect(edges.map((edge) => `${edge.source}->${edge.target}`).sort()).toEqual([
      'a.b.z->a.x',
      'a.x->c',
      'a.y->c',
    ])
  })

  it('routes hidden objects through their collapsed group and aggregates edges', () => {
    const { objectNodes, collapsedGroupIds, edges } = buildVisibleGraph(
      GRAPH,
      new Set(['a']),
      null,
    )
    expect(objectNodes.map((node) => node.id).sort()).toEqual(['c'])
    expect([...collapsedGroupIds]).toEqual(['a'])

    const toC = edges.find((edge) => edge.target === 'c')
    expect(toC.source).toBe('ns:a')
    expect(toC.count).toBe(2)

    const internal = edges.find((edge) => edge.source === 'ns:a' && edge.target === 'ns:a')
    expect(internal).toBeUndefined()
  })

  it('routes a nested collapsed group through its own proxy', () => {
    const { collapsedGroupIds, edges } = buildVisibleGraph(GRAPH, new Set(['a.b']), null)
    expect([...collapsedGroupIds].sort()).toEqual(['a.b'])
    const edge = edges.find((item) => item.source === 'ns:a.b')
    expect(edge.target).toBe('a.x')
  })
})

describe('filterObjectIds', () => {
  it('returns an empty set for an empty selection', () => {
    expect(filterObjectIds(GRAPH, new Set())).toEqual(new Set())
  })

  it('keeps the selection and adds its dependencies', () => {
    const ids = filterObjectIds(GRAPH, new Set(['c']))
    expect([...ids].sort()).toEqual(['a.x', 'a.y', 'c'])
  })
})

describe('buildNamespaceTree', () => {
  const entries = [
    { qualifiedName: 'a.x', namespace: 'a', model: { name: 'x' } },
    { qualifiedName: 'a.b.y', namespace: 'a.b', model: { name: 'y' } },
    { qualifiedName: 'root', namespace: null, model: { name: 'root' } },
  ]

  it('nests directories and lists files', () => {
    const tree = buildNamespaceTree(entries)
    expect(tree.files.map((file) => file.qualifiedName)).toEqual(['root'])
    expect([...tree.folders.keys()]).toEqual(['a'])
    const a = tree.folders.get('a')
    expect(a.files.map((file) => file.qualifiedName)).toEqual(['a.x'])
    expect([...a.folders.keys()]).toEqual(['b'])
    expect(subtreeObjectIds(a)).toEqual(new Set(['a.x', 'a.b.y']))
  })

  it('falls back to the file base name without the project', () => {
    const tree = buildNamespaceTree([
      {
        qualifiedName: 'Projet Foncier+.FONCIER_PLUS.friches',
        namespace: 'Projet Foncier+.FONCIER_PLUS',
        fileName: 'Projet Foncier+/FONCIER_PLUS/friches.yaml',
        model: null,
      },
    ])
    const foncier = tree.folders.get('Projet Foncier+').folders.get('FONCIER_PLUS')
    expect(foncier.files[0].name).toBe('friches')
  })
})
