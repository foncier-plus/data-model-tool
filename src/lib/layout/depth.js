export function computeDepths(units, edges) {
  const known = new Set(units.map((unit) => unit.id))
  const depth = new Map(units.map((unit) => [unit.id, 0]))
  for (let pass = 0; pass < units.length; pass += 1) {
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
