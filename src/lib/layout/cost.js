import { DEFAULT_WEIGHTS } from './constants.js'

export function resolveWeights(weights) {
  return { ...DEFAULT_WEIGHTS, ...(weights ?? {}) }
}

export function countCrossings(edges, leftOrder, rightOrder) {
  const pairs = []
  for (const edge of edges) {
    const left = leftOrder.get(edge.source)
    const right = rightOrder.get(edge.target)
    if (left === undefined || right === undefined) continue
    pairs.push([left, right])
  }
  if (pairs.length > 400) return null
  let crossings = 0
  for (let i = 0; i < pairs.length; i += 1) {
    for (let j = i + 1; j < pairs.length; j += 1) {
      if ((pairs[i][0] - pairs[j][0]) * (pairs[i][1] - pairs[j][1]) < 0) crossings += 1
    }
  }
  return crossings
}

export function rankMap(column) {
  const ranks = new Map()
  column.forEach((id, index) => ranks.set(id, index))
  return ranks
}
