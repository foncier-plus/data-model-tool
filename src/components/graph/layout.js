export const NODE_WIDTH = 300
const HEADER_HEIGHT = 34
const ROW_HEIGHT = 20
const GROUP_HEADER_HEIGHT = 20
const PADDING = 12
const GAP = 4

const MAX_TEMPERATURE = 160
const ITERATIONS = 300
const SEED = 1
export const ANCHOR_Y = 16
const ALIGNMENT = 15
const LAYER_FORCE = 0.5
const REPULSION = 0.3
const CENTERING = 0.05

export function objectHeight(model) {
  const rootAttributes = model.attributes?.length ?? 0
  const groups = model.groups ?? []
  const items = rootAttributes + groups.length

  let height = HEADER_HEIGHT + PADDING
  height += rootAttributes * ROW_HEIGHT
  height += Math.max(items - 1, 0) * GAP
  for (const group of groups) {
    height += GROUP_HEADER_HEIGHT + PADDING
    height += (group.attributes?.length ?? 0) * ROW_HEIGHT
  }
  height += PADDING
  return height
}

export function objectSize(model) {
  return { width: NODE_WIDTH, height: objectHeight(model) }
}

export function computeDepths(nodes, edges) {
  const known = new Set(nodes.map((node) => node.id))
  const depth = new Map(nodes.map((node) => [node.id, 0]))
  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false
    for (const edge of edges) {
      if (!known.has(edge.source) || !known.has(edge.target)) continue
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

export function leftAnchor(node, position) {
  return { x: position.x, y: position.y + ANCHOR_Y }
}

export function rightAnchor(node, position) {
  return { x: position.x + node.width, y: position.y + ANCHOR_Y }
}

function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function centerOf(node, position) {
  return { x: position.x + node.width / 2, y: position.y + node.height / 2 }
}

function buildGrid(nodes, positions, cell) {
  const grid = new Map()
  for (const node of nodes) {
    const center = centerOf(node, positions.get(node.id))
    const key = `${Math.floor(center.x / cell)},${Math.floor(center.y / cell)}`
    const bucket = grid.get(key)
    if (bucket) bucket.push(node)
    else grid.set(key, [node])
  }
  return grid
}

function forEachNearPair(nodes, positions, cell, callback) {
  const order = new Map(nodes.map((node, index) => [node.id, index]))
  const grid = buildGrid(nodes, positions, cell)
  for (const [key, bucket] of grid) {
    const [cellX, cellY] = key.split(',').map(Number)
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const neighbor = grid.get(`${cellX + dx},${cellY + dy}`)
        if (!neighbor) continue
        for (const a of bucket) {
          for (const b of neighbor) {
            if (order.get(a.id) >= order.get(b.id)) continue
            callback(a, b)
          }
        }
      }
    }
  }
}

function interactionCell(nodes, padding) {
  let extent = 0
  for (const node of nodes) {
    extent = Math.max(extent, node.width, node.height)
  }
  return Math.max(extent + padding, 1)
}

function separateOnce(nodes, positions, cell, padding, fixed) {
  let moved = false
  forEachNearPair(nodes, positions, cell, (a, b) => {
    const ca = centerOf(a, positions.get(a.id))
    const cb = centerOf(b, positions.get(b.id))
    const minX = (a.width + b.width) / 2 + padding
    const minY = (a.height + b.height) / 2 + padding
    const dx = cb.x - ca.x
    const dy = cb.y - ca.y
    const overlapX = minX - Math.abs(dx)
    const overlapY = minY - Math.abs(dy)
    if (overlapX <= 0 || overlapY <= 0) return
    const aFixed = fixed.has(a.id)
    const bFixed = fixed.has(b.id)
    if (aFixed && bFixed) return
    moved = true
    const positionA = positions.get(a.id)
    const positionB = positions.get(b.id)
    if (overlapX < overlapY) {
      const direction = dx < 0 ? -1 : 1
      const push = overlapX + 0.5
      if (aFixed) positionB.x += push * direction
      else if (bFixed) positionA.x -= push * direction
      else {
        positionA.x -= (push / 2) * direction
        positionB.x += (push / 2) * direction
      }
    } else {
      const direction = dy < 0 ? -1 : 1
      const push = overlapY + 0.5
      if (aFixed) positionB.y += push * direction
      else if (bFixed) positionA.y -= push * direction
      else {
        positionA.y -= (push / 2) * direction
        positionB.y += (push / 2) * direction
      }
    }
  })
  return moved
}

export function separateOverlaps({ nodes, positions, fixed = new Set(), padding = 20, passes = 40 }) {
  const cell = interactionCell(nodes, padding)
  const next = new Map()
  for (const [id, position] of positions) {
    next.set(id, { x: position.x, y: position.y })
  }
  for (let pass = 0; pass < passes; pass += 1) {
    if (!separateOnce(nodes, next, cell, padding, fixed)) break
  }
  return next
}

export function forceLayout({ nodes, edges, options = {}, initial }) {
  const opts = { repulsionDistance: 20, linkDistance: 40, ...options }
  const result = new Map()
  if (nodes.length === 0) return result

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const random = mulberry32(SEED)
  const positions = new Map()
  for (const node of nodes) {
    const start = initial?.get(node.id)
    positions.set(
      node.id,
      start ? { x: start.x, y: start.y } : { x: (random() - 0.5) * 80, y: (random() - 0.5) * 80 },
    )
  }

  const anchorRest = opts.linkDistance
  const ideal = NODE_WIDTH + anchorRest
  const cutoff = ideal * 2
  const cell = Math.max(cutoff, interactionCell(nodes, opts.repulsionDistance))
  const depth = computeDepths(nodes, edges)
  const columnWidth = NODE_WIDTH + Math.max(anchorRest, opts.repulsionDistance)

  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    const displacement = new Map(nodes.map((node) => [node.id, { x: 0, y: 0 }]))

    forEachNearPair(nodes, positions, cell, (a, b) => {
      const pa = positions.get(a.id)
      const pb = positions.get(b.id)
      let dx = pa.x - pb.x
      let dy = pa.y - pb.y
      let distance = Math.hypot(dx, dy)
      if (distance > cutoff) return
      if (distance < 0.01) {
        dx = random() - 0.5
        dy = random() - 0.5
        distance = Math.hypot(dx, dy) || 0.01
      }
      const force = ((ideal * ideal) / distance) * REPULSION
      const moveA = displacement.get(a.id)
      const moveB = displacement.get(b.id)
      moveA.x += (dx / distance) * force
      moveA.y += (dy / distance) * force
      moveB.x -= (dx / distance) * force
      moveB.y -= (dy / distance) * force
    })

    for (const edge of edges) {
      const source = byId.get(edge.source)
      const target = byId.get(edge.target)
      if (!source || !target || source.id === target.id) continue
      const sourceAnchor = rightAnchor(source, positions.get(source.id))
      const targetAnchor = leftAnchor(target, positions.get(target.id))
      const forceY = (targetAnchor.y - sourceAnchor.y) * ALIGNMENT
      const moveSource = displacement.get(source.id)
      const moveTarget = displacement.get(target.id)
      moveSource.y += forceY
      moveTarget.y -= forceY
    }

    for (const node of nodes) {
      const move = displacement.get(node.id)
      const columnX = depth.get(node.id) * columnWidth
      move.x += (columnX - positions.get(node.id).x) * LAYER_FORCE
    }

    const temperature = MAX_TEMPERATURE * (1 - iteration / ITERATIONS)
    let centerX = 0
    let centerY = 0
    for (const node of nodes) {
      const position = positions.get(node.id)
      const move = displacement.get(node.id)
      move.x -= position.x * CENTERING
      move.y -= position.y * CENTERING
      const length = Math.hypot(move.x, move.y)
      if (length > 0.01) {
        const step = Math.min(length, temperature)
        position.x += (move.x / length) * step
        position.y += (move.y / length) * step
      }
      centerX += position.x
      centerY += position.y
    }

    centerX /= nodes.length
    centerY /= nodes.length
    for (const node of nodes) {
      const position = positions.get(node.id)
      position.x -= centerX
      position.y -= centerY
    }

    const separated = separateOverlaps({
      nodes,
      positions,
      padding: opts.repulsionDistance,
      passes: 3,
    })
    for (const [id, position] of separated) {
      const current = positions.get(id)
      current.x = position.x
      current.y = position.y
    }
  }

  for (const node of nodes) {
    positions.get(node.id).x = depth.get(node.id) * columnWidth
  }

  const settled = separateOverlaps({
    nodes,
    positions,
    padding: opts.repulsionDistance,
    passes: 2000,
  })

  for (const [id, position] of settled) {
    const current = positions.get(id)
    current.x = position.x
    current.y = position.y
  }

  for (const node of nodes) {
    positions.get(node.id).x = depth.get(node.id) * columnWidth
  }

  for (const [id, position] of positions) {
    result.set(id, { x: Math.round(position.x), y: Math.round(position.y) })
  }
  return result
}
