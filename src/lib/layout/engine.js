import {
  DEFAULT_OPTIONS,
  NAMESPACE_PADDING,
  NS_HEADER_HEIGHT,
} from './constants.js'
import { resolveWeights } from './cost.js'
import { computeDepths } from './depth.js'
import {
  buildLayoutHierarchy,
  buildLevelEdges,
  unitContainers,
} from './hierarchy.js'
import { optimizeColumnOrdering } from './ordering.js'
import { solveVerticalPositions } from './relax.js'

function resolveOptions(options) {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    weights: resolveWeights(options?.weights ?? DEFAULT_OPTIONS.weights),
  }
}

function assignColumns(units, positions, depth, columnGap) {
  const widths = new Map()
  for (const unit of units) {
    const value = depth.get(unit.id) ?? 0
    widths.set(value, Math.max(widths.get(value) ?? 0, unit.width))
  }
  const depths = [...widths.keys()].sort((a, b) => a - b)
  const starts = new Map()
  let cursor = 0
  for (const value of depths) {
    starts.set(value, cursor)
    cursor += widths.get(value) + columnGap
  }
  for (const unit of units) {
    const value = depth.get(unit.id) ?? 0
    positions.get(unit.id).x = starts.get(value)
  }
}

function layoutGroup(group, context) {
  for (const child of group.children) layoutGroup(context.groups.get(child), context)

  const levelUnits = []
  for (const unit of group.objects) {
    levelUnits.push({ id: unit.id, width: unit.width, height: unit.height, kind: 'object' })
  }
  for (const unit of group.collapsedUnits) {
    levelUnits.push({ id: unit.id, width: unit.width, height: unit.height, kind: 'collapsed' })
  }
  for (const child of group.children) {
    const size = context.sizes.get(child)
    levelUnits.push({
      id: `ns:${child}`,
      width: size.width,
      height: size.height,
      kind: 'group',
      groupFullName: child,
    })
  }

  if (levelUnits.length === 0) {
    group.local = []
    return
  }

  const edges = buildLevelEdges(
    context.allUnits,
    context.containers,
    context.edges,
    group.fullName,
  )
  const depth = computeDepths(levelUnits, edges)
  const order = optimizeColumnOrdering({
    units: levelUnits,
    edges,
    depth,
    previous: context.initial,
    options: context.options,
  })
  const positions = solveVerticalPositions({
    units: levelUnits,
    edges,
    depth,
    order,
    previous: context.initial,
    options: context.options,
  })
  assignColumns(levelUnits, positions, depth, context.options.columnGap)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const unit of levelUnits) {
    const position = positions.get(unit.id)
    minX = Math.min(minX, position.x)
    minY = Math.min(minY, position.y)
    maxX = Math.max(maxX, position.x + unit.width)
    maxY = Math.max(maxY, position.y + unit.height)
  }

  group.local = levelUnits.map((unit) => ({
    ...unit,
    x: positions.get(unit.id).x - minX,
    y: positions.get(unit.id).y - minY,
  }))

  if (group.fullName !== null) {
    context.sizes.set(group.fullName, {
      width: maxX - minX + NAMESPACE_PADDING * 2,
      height: maxY - minY + NAMESPACE_PADDING * 2 + NS_HEADER_HEIGHT,
    })
  }
}

function embed(root, context) {
  const place = (group, offsetX, offsetY) => {
    for (const unit of group.local ?? []) {
      if (unit.kind === 'group') {
        const child = context.groups.get(unit.groupFullName)
        const size = context.sizes.get(unit.groupFullName)
        const x = offsetX + unit.x
        const y = offsetY + unit.y
        context.groupRects.set(unit.groupFullName, {
          fullName: unit.groupFullName,
          parent: child.parent,
          x,
          y,
          width: size.width,
          height: size.height,
        })
        place(
          child,
          x + NAMESPACE_PADDING,
          y + NS_HEADER_HEIGHT + NAMESPACE_PADDING,
        )
      } else {
        context.globalPositions.set(unit.id, { x: offsetX + unit.x, y: offsetY + unit.y })
      }
    }
  }
  place(root, 0, 0)
}

function groupsArray(groupRects) {
  return [...groupRects.values()]
    .map((rect) => ({
      id: `ns:${rect.fullName}`,
      fullName: rect.fullName,
      label: rect.fullName,
      parent: rect.parent,
      depth: rect.fullName.split('.').length,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }))
    .sort((a, b) => a.depth - b.depth)
}

function relativeMaps(units, containers, positions, groupRects) {
  const unitRelative = new Map()
  for (const unit of units) {
    const position = positions.get(unit.id)
    if (!position) continue
    const container = containers.get(unit.id)
    const base = container ? groupRects.get(container) : null
    unitRelative.set(
      unit.id,
      base ? { x: position.x - base.x, y: position.y - base.y } : { x: position.x, y: position.y },
    )
  }

  const groupRelative = new Map()
  for (const [fullName, rect] of groupRects) {
    const base = rect.parent ? groupRects.get(rect.parent) : null
    groupRelative.set(
      `ns:${fullName}`,
      base ? { x: rect.x - base.x, y: rect.y - base.y } : { x: rect.x, y: rect.y },
    )
  }

  return { unitRelative, groupRelative }
}

export function hierarchyLayout({ units, edges, collapsed = new Set(), options = {}, initial }) {
  if (units.length === 0) {
    return {
      positions: new Map(),
      groups: [],
      unitRelative: new Map(),
      groupRelative: new Map(),
    }
  }

  const resolved = resolveOptions(options)
  const { root, groups } = buildLayoutHierarchy({ units, collapsed })
  const containers = unitContainers(units, collapsed)
  const context = {
    groups,
    edges,
    initial,
    options: resolved,
    sizes: new Map(),
    globalPositions: new Map(),
    groupRects: new Map(),
    allUnits: units,
    containers,
  }

  layoutGroup(root, context)
  embed(root, context)

  const { unitRelative, groupRelative } = relativeMaps(
    units,
    containers,
    context.globalPositions,
    context.groupRects,
  )

  return {
    positions: context.globalPositions,
    groups: groupsArray(context.groupRects),
    unitRelative,
    groupRelative,
  }
}

export function finishLayout({ units, positions, collapsed = new Set() }) {
  const { root, groups } = buildLayoutHierarchy({ units, collapsed })
  const containers = unitContainers(units, collapsed)
  const groupRects = new Map()

  const compute = (group) => {
    for (const child of group.children) compute(groups.get(child))
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    const consider = (x, y, width, height) => {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + width)
      maxY = Math.max(maxY, y + height)
    }
    for (const unit of group.objects) {
      const position = positions.get(unit.id)
      if (position) consider(position.x, position.y, unit.width, unit.height)
    }
    for (const unit of group.collapsedUnits) {
      const position = positions.get(unit.id)
      if (position) consider(position.x, position.y, unit.width, unit.height)
    }
    for (const child of group.children) {
      const rect = groupRects.get(child)
      if (rect) consider(rect.x, rect.y, rect.width, rect.height)
    }
    if (!Number.isFinite(minX)) return
    if (group.fullName === null) return
    groupRects.set(group.fullName, {
      fullName: group.fullName,
      parent: group.parent,
      x: minX - NAMESPACE_PADDING,
      y: minY - NAMESPACE_PADDING - NS_HEADER_HEIGHT,
      width: maxX - minX + NAMESPACE_PADDING * 2,
      height: maxY - minY + NAMESPACE_PADDING * 2 + NS_HEADER_HEIGHT,
    })
  }

  compute(root)

  const { unitRelative, groupRelative } = relativeMaps(units, containers, positions, groupRects)

  return { positions, groups: groupsArray(groupRects), unitRelative, groupRelative }
}
