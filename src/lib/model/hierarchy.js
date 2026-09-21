export function namespaceParts(namespace) {
  return namespace ? namespace.split('.') : []
}

export function namespaceParent(namespace) {
  const parts = namespaceParts(namespace)
  return parts.length > 1 ? parts.slice(0, -1).join('.') : null
}

export function namespacePrefixes(namespace) {
  const parts = namespaceParts(namespace)
  const prefixes = []
  let current = ''
  for (const part of parts) {
    current = current ? `${current}.${part}` : part
    prefixes.push(current)
  }
  return prefixes
}

export function nearestCollapsedAncestor(namespace, collapsed) {
  if (!namespace || !collapsed.size) return null
  const prefixes = namespacePrefixes(namespace)
  for (let i = prefixes.length - 1; i >= 0; i -= 1) {
    if (collapsed.has(prefixes[i])) return prefixes[i]
  }
  return null
}

export function nearestExpandedNamespace(namespace, collapsed) {
  if (!namespace) return null
  let result = null
  for (const prefix of namespacePrefixes(namespace)) {
    if (collapsed.has(prefix)) break
    result = prefix
  }
  return result
}

export function proxyId(objectName, namespace, collapsed) {
  const ancestor = nearestCollapsedAncestor(namespace, collapsed)
  return ancestor ? `ns:${ancestor}` : objectName
}

export function buildNamespaceTree(entries) {
  const root = { namespace: null, folders: new Map(), files: [] }
  const sorted = [...entries].sort((a, b) =>
    (a.qualifiedName ?? '').localeCompare(b.qualifiedName ?? ''),
  )
  for (const entry of sorted) {
    const qualifiedName = entry.qualifiedName ?? entry.model?.name ?? ''
    const namespace = entry.namespace ?? null
    if (!namespace) {
      root.files.push({ qualifiedName, name: entry.model?.name ?? qualifiedName })
      continue
    }
    let node = root
    let current = ''
    for (const part of namespace.split('.')) {
      current = current ? `${current}.${part}` : part
      if (!node.folders.has(part)) {
        node.folders.set(part, {
          name: part,
          namespace: current,
          folders: new Map(),
          files: [],
        })
      }
      node = node.folders.get(part)
    }
    node.files.push({ qualifiedName, name: entry.model?.name ?? qualifiedName })
  }
  return root
}

export function subtreeObjectIds(tree) {
  const ids = new Set()
  const visit = (node) => {
    for (const file of node.files) ids.add(file.qualifiedName)
    for (const folder of node.folders.values()) visit(folder)
  }
  visit(tree)
  return ids
}

export function filterObjectIds(_objectGraph, selectedObjects) {
  return new Set(selectedObjects ?? [])
}

export function buildVisibleGraph(objectGraph, collapsed, objectIds) {
  const namespaceOf = new Map(objectGraph.nodes.map((node) => [node.id, node.namespace ?? null]))
  const objectNodes = []
  const collapsedGroupIds = new Set()
  const visibleObjectIds = new Set()

  for (const node of objectGraph.nodes) {
    if (objectIds && !objectIds.has(node.id)) continue
    const ancestor = nearestCollapsedAncestor(node.namespace ?? null, collapsed)
    if (ancestor) collapsedGroupIds.add(ancestor)
    else {
      objectNodes.push(node)
      visibleObjectIds.add(node.id)
    }
  }

  const byKey = new Map()
  for (const edge of objectGraph.edges) {
    if (objectIds && (!objectIds.has(edge.source) || !objectIds.has(edge.target))) continue
    const source = proxyId(edge.source, namespaceOf.get(edge.source), collapsed)
    const target = proxyId(edge.target, namespaceOf.get(edge.target), collapsed)
    if (source === target) continue
    const key = `${source}->${target}`
    const aggregated =
      byKey.get(key) ?? { id: key, source, target, count: 0, details: [] }
    aggregated.count += edge.count
    aggregated.details.push(...edge.details)
    byKey.set(key, aggregated)
  }

  return {
    objectNodes,
    collapsedGroupIds,
    visibleObjectIds,
    edges: [...byKey.values()],
  }
}
