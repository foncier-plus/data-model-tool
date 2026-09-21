import {
  namespaceParent,
  namespacePrefixes,
  nearestExpandedNamespace,
} from '@/lib/model/hierarchy'

export function containerOf(unit, collapsed) {
  const namespace = unit.namespace ?? null
  if (!namespace) return null
  if (unit.kind === 'collapsed') {
    return nearestExpandedNamespace(namespaceParent(namespace), collapsed)
  }
  return nearestExpandedNamespace(namespace, collapsed)
}

export function buildLayoutHierarchy({ units, collapsed }) {
  const groups = new Map()

  const root = {
    fullName: null,
    parent: null,
    objects: [],
    collapsedUnits: [],
    children: new Set(),
  }

  const ensure = (fullName) => {
    if (fullName === null || fullName === undefined) return null
    const existing = groups.get(fullName)
    if (existing) return existing
    const parent = namespaceParent(fullName)
    const node = {
      fullName,
      parent,
      objects: [],
      collapsedUnits: [],
      children: new Set(),
    }
    groups.set(fullName, node)
    const parentNode = ensure(parent)
    if (parentNode) parentNode.children.add(fullName)
    else root.children.add(fullName)
    return node
  }

  for (const unit of units) {
    const container = containerOf(unit, collapsed)
    const group = container ? ensure(container) : root
    if (unit.kind === 'collapsed') group.collapsedUnits.push(unit)
    else group.objects.push(unit)
  }

  return { root, groups }
}

export function unitContainers(units, collapsed) {
  const containers = new Map()
  for (const unit of units) {
    containers.set(unit.id, containerOf(unit, collapsed))
  }
  return containers
}

export function childUnitAt(unit, container, level) {
  if (container === level) return unit.id
  const path = container ? namespacePrefixes(container) : []
  if (level === null) return path.length ? `ns:${path[0]}` : unit.id
  const index = path.indexOf(level)
  if (index === -1) return null
  if (index === path.length - 1) return unit.id
  return `ns:${path[index + 1]}`
}

export function buildLevelEdges(units, containers, edges, level) {
  const byId = new Map(units.map((unit) => [unit.id, unit]))
  const aggregated = new Map()
  for (const edge of edges) {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) continue
    const sourceUnit = childUnitAt(source, containers.get(source.id), level)
    const targetUnit = childUnitAt(target, containers.get(target.id), level)
    if (!sourceUnit || !targetUnit || sourceUnit === targetUnit) continue
    const key = `${sourceUnit}->${targetUnit}`
    const existing = aggregated.get(key)
    if (existing) {
      existing.count += edge.count ?? 1
      continue
    }
    aggregated.set(key, {
      id: key,
      source: sourceUnit,
      target: targetUnit,
      count: edge.count ?? 1,
    })
  }
  return [...aggregated.values()]
}
