import { attributeRef, collectOrigins, entryName, findObjectConflicts, resolveRef } from './refs.js'

function addTo(map, id, factory) {
  const existing = map.get(id)
  if (existing) return existing
  const created = factory()
  map.set(id, created)
  return created
}

// Resolve the owning object of a reference. Falls back to the longest
// resolvable prefix so object-level links still work when the exact
// attribute name is missing (e.g. "NS1.ObjectBeta.beta1" -> "NS1.ObjectBeta").
function resolveOriginObject(ref, index, namespace) {
  const direct = resolveRef(ref, index, namespace)
  if (direct) return direct.objectName
  const parts = ref.split('.')
  for (let length = parts.length - 1; length >= 1; length -= 1) {
    const hit = resolveRef(parts.slice(0, length).join('.'), index, namespace)
    if (hit) return hit.objectName
  }
  return null
}

export function buildObjectGraph(objects, index) {
  const nodes = new Map()
  const edges = new Map()
  const conflicts = findObjectConflicts(objects)

  for (const entry of objects) {
    const { model } = entry
    if (!model) continue
    const name = entryName(entry)
    if (nodes.has(name)) continue
    nodes.set(name, {
      id: name,
      label: model.name,
      kind: 'object',
      objectName: name,
      namespace: entry.namespace ?? null,
      fileName: entry.fileName,
      model,
      conflict: conflicts.has(name),
      files: conflicts.get(name) ?? null,
    })
  }

  for (const entry of objects) {
    const { model } = entry
    if (!model) continue
    const name = entryName(entry)
    for (const source of collectOrigins(model, name)) {
      for (const ref of source.origin.from ?? []) {
        const from = resolveOriginObject(ref, index, entry.namespace ?? null)
        if (!from) continue
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
