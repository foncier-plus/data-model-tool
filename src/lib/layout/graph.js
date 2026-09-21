import {
  namespaceParent,
  namespacePrefixes,
  nearestExpandedNamespace,
} from '@/lib/model/hierarchy'
import {
  COLLAPSED_GROUP_HEIGHT,
  COLLAPSED_GROUP_WIDTH,
  NAMESPACE_PADDING,
  NS_HEADER_HEIGHT,
} from './constants.js'

export function containerOf(unit, collapsed) {
  const namespace = unit.namespace ?? null
  if (!namespace) return null
  if (unit.kind === 'collapsed') {
    return nearestExpandedNamespace(namespaceParent(namespace), collapsed)
  }
  return nearestExpandedNamespace(namespace, collapsed)
}

function childUnitAt(unit, container, level) {
  if (container === level) return unit.id
  const path = container ? namespacePrefixes(container) : []
  if (level === null) return path.length ? `ns:${path[0]}` : unit.id
  const index = path.indexOf(level)
  if (index === -1) return null
  if (index === path.length - 1) return unit.id
  return `ns:${path[index + 1]}`
}

export function computeDepths(elements, edges) {
  const known = new Set(elements.map((element) => element.id))
  const depth = new Map(elements.map((element) => [element.id, 0]))
  for (let pass = 0; pass < elements.length; pass += 1) {
    let changed = false
    for (const edge of edges) {
      if (!known.has(edge.source) || !known.has(edge.target)) continue
      if (edge.source === edge.target) continue
      const next = depth.get(edge.source) + 1
      if (next > depth.get(edge.target)) {
        depth.set(edge.target, next)
        changed = true
      }
    }
    if (!changed) break
  }
  return depth
}

function buildLevelEdges(units, containers, edges, level) {
  const byId = new Map(units.map((unit) => [unit.id, unit]))
  const aggregated = new Map()
  for (const edge of edges) {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) continue
    const sourceUnit = childUnitAt(source, containers.get(source.id), level)
    const targetUnit = childUnitAt(target, containers.get(target.id), level)
    if (!sourceUnit || !targetUnit || sourceUnit === targetUnit) continue
    aggregated.set(`${sourceUnit}->${targetUnit}`, { source: sourceUnit, target: targetUnit })
  }
  return [...aggregated.values()]
}

function average(values) {
  if (!values || values.length === 0) return null
  let sum = 0
  for (const value of values) sum += value
  return sum / values.length
}

export function layoutLevel(elements, edges, columnGap) {
  const depth = computeDepths(elements, edges)
  const columns = new Map()
  for (const element of elements) {
    const value = depth.get(element.id) ?? 0
    if (!columns.has(value)) columns.set(value, [])
    columns.get(value).push(element)
  }
  const depths = [...columns.keys()].sort((a, b) => a - b)

  for (const value of depths) {
    columns.get(value).sort((a, b) => a.id.localeCompare(b.id))
  }

  for (let index = 1; index < depths.length; index += 1) {
    const previous = columns.get(depths[index - 1])
    const previousIndex = new Map(previous.map((element, position) => [element.id, position]))
    const neighbors = new Map()
    for (const edge of edges) {
      if (!previousIndex.has(edge.source)) continue
      const list = neighbors.get(edge.target) ?? []
      list.push(previousIndex.get(edge.source))
      neighbors.set(edge.target, list)
    }
    columns.get(depths[index]).sort((a, b) => {
      const ba = average(neighbors.get(a.id))
      const bb = average(neighbors.get(b.id))
      const va = ba ?? previous.length
      const vb = bb ?? previous.length
      if (va !== vb) return va - vb
      return a.id.localeCompare(b.id)
    })
  }

  const widths = new Map()
  for (const value of depths) {
    widths.set(
      value,
      columns.get(value).reduce((max, element) => Math.max(max, element.width), 0),
    )
  }

  const starts = new Map()
  let cursor = 0
  for (const value of depths) {
    starts.set(value, cursor)
    cursor += widths.get(value) + columnGap
  }

  const positions = new Map()
  const rowGap = columnGap * 0.25
  for (const value of depths) {
    let y = 0
    for (const element of columns.get(value)) {
      positions.set(element.id, { x: starts.get(value), y })
      y += element.height + rowGap
    }
  }
  return positions
}

export function layoutGraph({ units, edges, collapsed, sizes, columnGap }) {
  const groups = new Map()
  const root = {
    fullName: null,
    parent: null,
    objects: [],
    collapsedUnits: [],
    children: new Set(),
  }

  const ensure = (fullName) => {
    if (!fullName) return null
    const existing = groups.get(fullName)
    if (existing) return existing
    const node = { fullName, parent: namespaceParent(fullName), objects: [], collapsedUnits: [], children: new Set() }
    groups.set(fullName, node)
    const parent = ensure(node.parent)
    if (parent) parent.children.add(fullName)
    else root.children.add(fullName)
    return node
  }

  const containers = new Map()
  for (const unit of units) {
    const container = containerOf(unit, collapsed)
    containers.set(unit.id, container)
    const group = container ? ensure(container) : root
    if (unit.kind === 'collapsed') group.collapsedUnits.push(unit)
    else group.objects.push(unit)
  }

  const groupSizes = new Map()

  const layoutNode = (node) => {
    for (const child of node.children) layoutNode(groups.get(child))

    const elements = []
    for (const unit of node.objects) {
      const size = sizes.get(unit.id) ?? { width: 0, height: 0 }
      elements.push({ id: unit.id, width: size.width, height: size.height })
    }
    for (const unit of node.collapsedUnits) {
      elements.push({
        id: unit.id,
        width: COLLAPSED_GROUP_WIDTH,
        height: COLLAPSED_GROUP_HEIGHT,
      })
    }
    for (const child of node.children) {
      const size = groupSizes.get(child)
      elements.push({ id: `ns:${child}`, width: size.width, height: size.height })
    }

    if (elements.length === 0) {
      node.elements = []
      node.local = new Map()
      return
    }

    const levelEdges = buildLevelEdges(units, containers, edges, node.fullName)
    const positions = layoutLevel(elements, levelEdges, columnGap)

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const element of elements) {
      const position = positions.get(element.id)
      minX = Math.min(minX, position.x)
      minY = Math.min(minY, position.y)
      maxX = Math.max(maxX, position.x + element.width)
      maxY = Math.max(maxY, position.y + element.height)
    }

    node.elements = elements
    node.local = new Map(
      elements.map((element) => {
        const position = positions.get(element.id)
        return [element.id, { x: position.x - minX, y: position.y - minY }]
      }),
    )

    if (node.fullName !== null) {
      groupSizes.set(node.fullName, {
        width: maxX - minX + NAMESPACE_PADDING * 2,
        height: maxY - minY + NAMESPACE_PADDING * 2 + NS_HEADER_HEIGHT,
      })
    }
  }

  layoutNode(root)

  const positions = new Map()
  const groupRects = new Map()

  const place = (node, offsetX, offsetY) => {
    for (const element of node.elements) {
      const local = node.local.get(element.id)
      const x = offsetX + local.x
      const y = offsetY + local.y
      if (element.id.startsWith('ns:')) {
        const fullName = element.id.slice(3)
        if (groups.has(fullName)) {
          const size = groupSizes.get(fullName)
          groupRects.set(fullName, { x, y, width: size.width, height: size.height })
          place(
            groups.get(fullName),
            x + NAMESPACE_PADDING,
            y + NS_HEADER_HEIGHT + NAMESPACE_PADDING,
          )
          continue
        }
      }
      positions.set(element.id, { x, y })
    }
  }

  place(root, 0, 0)

  return { positions, groups: groupRects }
}
