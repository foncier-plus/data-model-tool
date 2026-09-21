import { MAX_ITERATIONS, MIN_ITERATIONS } from './constants.js'

function resolveCollisions(unitsById, columns, positions, gap) {
  for (const ids of columns.values()) {
    for (let index = 1; index < ids.length; index += 1) {
      const previous = unitsById.get(ids[index - 1])
      const previousPosition = positions.get(ids[index - 1])
      const currentPosition = positions.get(ids[index])
      const minimum = previousPosition.y + previous.height + gap
      if (currentPosition.y < minimum) currentPosition.y = minimum
    }
  }
}

export function solveVerticalPositions({ units, edges, order, previous, options }) {
  const unitsById = new Map(units.map((unit) => [unit.id, unit]))
  const { columns } = order
  const positions = new Map()
  const velocity = new Map()

  const anchors = new Map()
  let anchorSum = 0
  let anchorCount = 0
  for (const unit of units) {
    const anchor = previous?.get(unit.id)
    if (!anchor) continue
    anchorSum += anchor.y
    anchorCount += 1
  }
  const anchorBase = anchorCount ? anchorSum / anchorCount : 0
  for (const unit of units) {
    const anchor = previous?.get(unit.id)
    if (anchor) anchors.set(unit.id, anchor.y - anchorBase)
  }

  for (const ids of columns.values()) {
    let cursor = 0
    for (const id of ids) {
      const unit = unitsById.get(id)
      const anchor = anchors.get(id)
      const y = anchor ?? cursor
      positions.set(id, { x: 0, y })
      velocity.set(id, 0)
      cursor = Math.max(cursor, y + unit.height + options.collisionGap)
    }
  }

  const iterations = Math.min(
    MAX_ITERATIONS,
    Math.max(MIN_ITERATIONS, Math.round(units.length * 1.5)),
  )

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (const unit of units) {
      velocity.set(unit.id, velocity.get(unit.id) * options.damping)
    }

    for (const edge of edges) {
      const source = positions.get(edge.source)
      const target = positions.get(edge.target)
      if (!source || !target || edge.source === edge.target) continue
      const dy = target.y - source.y
      velocity.set(edge.source, velocity.get(edge.source) + dy * options.edgeStrength)
      velocity.set(edge.target, velocity.get(edge.target) - dy * options.edgeStrength)
    }

    for (const unit of units) {
      const position = positions.get(unit.id)
      const anchor = anchors.get(unit.id)
      let step = velocity.get(unit.id)
      if (anchor !== undefined) step += (anchor - position.y) * options.stability
      const clamped = Math.max(-options.maxStep, Math.min(options.maxStep, step))
      position.y += clamped
    }

    resolveCollisions(unitsById, columns, positions, options.collisionGap)
  }

  return positions
}
