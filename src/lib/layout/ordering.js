import { countCrossings, rankMap } from './cost.js'

function columnCrossings(column, columns, edgesByPair) {
  let total = 0
  for (const other of [column - 1, column + 1]) {
    if (!columns.has(other)) continue
    const key = `${Math.min(column, other)}:${Math.max(column, other)}`
    const pairEdges = edgesByPair.get(key)
    if (!pairEdges) continue
    const left = rankMap(columns.get(Math.min(column, other)))
    const right = rankMap(columns.get(Math.max(column, other)))
    const crossings = countCrossings(pairEdges, left, right)
    if (crossings === null) return null
    total += crossings
  }
  return total
}

function movementOf(ids, initialRank) {
  let total = 0
  ids.forEach((id, index) => {
    const base = initialRank.get(id)
    if (base === undefined) return
    total += Math.abs(index - base)
  })
  return total
}

function localSwapOptimization({ columns, depths, edgesByPair, initialRank, weights, enabled }) {
  if (!enabled) return
  for (let pass = 0; pass < 2; pass += 1) {
    for (const depth of depths) {
      const ids = columns.get(depth)
      if (!ids || ids.length < 2 || ids.length > 60) continue
      if (columnCrossings(depth, columns, edgesByPair) === null) continue
      for (let index = 0; index < ids.length - 1; index += 1) {
        const before = columnCrossings(depth, columns, edgesByPair)
        const beforeMove = movementOf(ids, initialRank)
        const first = ids[index]
        ids[index] = ids[index + 1]
        ids[index + 1] = first
        const after = columnCrossings(depth, columns, edgesByPair)
        const afterMove = movementOf(ids, initialRank)
        const delta =
          (after - before) * weights.crossings + (afterMove - beforeMove) * weights.movement
        if (delta >= 0) {
          const second = ids[index]
          ids[index] = ids[index + 1]
          ids[index + 1] = second
        }
      }
    }
  }
}

export function optimizeColumnOrdering({ units, edges, depth, previous, options }) {
  const columns = new Map()
  for (const unit of units) {
    const value = depth.get(unit.id) ?? 0
    if (!columns.has(value)) columns.set(value, [])
    columns.get(value).push(unit.id)
  }
  const depths = [...columns.keys()].sort((a, b) => a - b)

  for (const value of depths) {
    columns.get(value).sort((a, b) => {
      const pa = previous?.get(a)
      const pb = previous?.get(b)
      if (pa && pb && pa.y !== pb.y) return pa.y - pb.y
      if (pa && !pb) return -1
      if (pb && !pa) return 1
      return a.localeCompare(b)
    })
  }

  const initialRank = new Map()
  for (const value of depths) {
    columns.get(value).forEach((id, index) => initialRank.set(id, index))
  }

  const edgesByPair = new Map()
  const leftNeighbors = new Map()
  const rightNeighbors = new Map()
  const addNeighbor = (map, id, other) => {
    if (!map.has(id)) map.set(id, new Set())
    map.get(id).add(other)
  }

  for (const edge of edges) {
    const sourceDepth = depth.get(edge.source)
    const targetDepth = depth.get(edge.target)
    if (sourceDepth === undefined || targetDepth === undefined) continue
    if (sourceDepth === targetDepth) continue
    const key = `${Math.min(sourceDepth, targetDepth)}:${Math.max(sourceDepth, targetDepth)}`
    if (!edgesByPair.has(key)) edgesByPair.set(key, [])
    edgesByPair
      .get(key)
      .push(
        sourceDepth < targetDepth
          ? { source: edge.source, target: edge.target }
          : { source: edge.target, target: edge.source },
      )
    if (sourceDepth < targetDepth) {
      addNeighbor(rightNeighbors, edge.source, edge.target)
      addNeighbor(leftNeighbors, edge.target, edge.source)
    } else {
      addNeighbor(rightNeighbors, edge.target, edge.source)
      addNeighbor(leftNeighbors, edge.source, edge.target)
    }
  }

  const barycenterPass = (column, useLeft) => {
    const ids = columns.get(column)
    const neighborColumn = columns.get(useLeft ? column - 1 : column + 1)
    if (!neighborColumn) return
    const neighborRank = rankMap(neighborColumn)
    const neighbors = useLeft ? leftNeighbors : rightNeighbors
    const currentRank = rankMap(ids)
    const scored = ids.map((id) => {
      const set = neighbors.get(id)
      let sum = 0
      let count = 0
      if (set) {
        for (const neighbor of set) {
          const rank = neighborRank.get(neighbor)
          if (rank === undefined) continue
          sum += rank
          count += 1
        }
      }
      return { id, score: count ? sum / count : currentRank.get(id) }
    })
    scored.sort((a, b) => a.score - b.score)
    columns.set(
      column,
      scored.map((item) => item.id),
    )
  }

  for (let pass = 0; pass < 4; pass += 1) {
    const forward = pass % 2 === 0
    const sequence = forward ? depths : [...depths].reverse()
    for (const column of sequence) barycenterPass(column, forward)
  }

  localSwapOptimization({
    columns,
    depths,
    edgesByPair,
    initialRank,
    weights: options.weights,
    enabled: units.length <= 200,
  })

  const order = new Map()
  for (const column of depths) {
    columns.get(column).forEach((id, index) => order.set(id, index))
  }
  return { columns, order }
}
