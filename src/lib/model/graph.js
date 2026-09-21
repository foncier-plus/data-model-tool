import { attributeRef, collectOrigins, entryName, resolveRef } from './refs.js'

function addTo(map, id, factory) {
  const existing = map.get(id)
  if (existing) return existing
  const created = factory()
  map.set(id, created)
  return created
}

export function buildObjectGraph(objects, index) {
  const nodes = new Map()
  const edges = new Map()

  for (const entry of objects) {
    const { model } = entry
    if (!model) continue
    const name = entryName(entry)
    nodes.set(name, {
      id: name,
      label: model.name,
      kind: 'object',
      objectName: name,
      namespace: entry.namespace ?? null,
      model,
    })
  }

  for (const entry of objects) {
    const { model } = entry
    if (!model) continue
    const name = entryName(entry)
    for (const source of collectOrigins(model, name)) {
      for (const ref of source.origin.from ?? []) {
        const resolved = resolveRef(ref, index, entry.namespace ?? null)
        if (!resolved) continue
        const from = resolved.objectName
        const to = name
        if (!nodes.has(from) || from === to) continue
        const edge = addTo(edges, `${from}->${to}`, () => ({
          id: `${from}->${to}`,
          source: from,
          target: to,
          count: 0,
          details: [],
        }))
        edge.count += 1
        edge.details.push({ source: ref, target: source.ref, formula: source.origin.formula })
      }
    }
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] }
}

export function selectionObjectId(selection) {
  return selection?.objectName ?? null
}

export function buildAttributeEdges(objects, index) {
  const known = new Set()

  for (const entry of objects) {
    const { model } = entry
    if (!model) continue
    const name = entryName(entry)
    for (const attribute of model.attributes ?? []) {
      known.add(attributeRef(name, null, attribute.name))
    }
    for (const group of model.groups ?? []) {
      for (const attribute of group.attributes ?? []) {
        known.add(attributeRef(name, group.name, attribute.name))
      }
    }
  }

  const edges = new Map()

  for (const entry of objects) {
    const { model } = entry
    if (!model) continue
    const name = entryName(entry)

    const handle = (origin, targetRef) => {
      for (const ref of origin.from ?? []) {
        const resolved = resolveRef(ref, index, entry.namespace ?? null)
        if (!resolved || resolved.kind !== 'attribute') continue
        if (!known.has(resolved.ref) || resolved.ref === targetRef) continue
        const id = `${resolved.ref}->${targetRef}`
        const edge = addTo(edges, id, () => ({
          id,
          source: resolved.objectName,
          target: name,
          sourceHandle: resolved.ref,
          targetHandle: targetRef,
          sourceRef: resolved.ref,
          targetRef,
          details: [],
        }))
        edge.details.push({ source: ref, target: targetRef, formula: origin.formula })
      }
    }

    for (const attribute of model.attributes ?? []) {
      if (attribute.origin) handle(attribute.origin, attributeRef(name, null, attribute.name))
    }
    for (const group of model.groups ?? []) {
      for (const attribute of group.attributes ?? []) {
        if (attribute.origin) {
          handle(attribute.origin, attributeRef(name, group.name, attribute.name))
        }
      }
    }
  }

  return { edges: [...edges.values()] }
}

export function graphNeighbors(graph, nodeId) {
  const upstream = new Set()
  const downstream = new Set()
  if (!nodeId) return { upstream, downstream }
  for (const edge of graph.edges) {
    if (edge.target === nodeId) upstream.add(edge.source)
    if (edge.source === nodeId) downstream.add(edge.target)
  }
  return { upstream, downstream }
}
