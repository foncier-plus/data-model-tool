import { resolveRef } from '@/lib/model/refs'
import { withAlpha } from '@/lib/colors'

export function isUnresolved(origin, index, namespace) {
  return Boolean(origin?.from?.some((ref) => !resolveRef(ref, index, namespace)))
}

export function rowStateClass({ active, upstream, downstream, hasHighlight, dim }) {
  if (active) return 'bg-primary/20 ring-1 ring-primary'
  if (upstream) return 'bg-sky-500/15 ring-1 ring-sky-400'
  if (downstream) return 'bg-emerald-500/15 ring-1 ring-emerald-400'
  if (hasHighlight || dim) return 'opacity-40'
  return ''
}

export function groupBackground(color, { active, upstream, downstream }) {
  if (active) return withAlpha(color, 0.34)
  if (upstream) return 'rgba(14, 165, 233, 0.15)'
  if (downstream) return 'rgba(16, 185, 129, 0.15)'
  return withAlpha(color, 0.08)
}
