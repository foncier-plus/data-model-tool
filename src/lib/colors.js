const PALETTE = [
  '#2563eb',
  '#0891b2',
  '#059669',
  '#65a30d',
  '#ca8a04',
  '#ea580c',
  '#dc2626',
  '#db2777',
  '#9333ea',
  '#4f46e5',
  '#0d9488',
  '#7c3aed',
]

export function colorFor(name) {
  if (!name) return PALETTE[0]
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

export function withAlpha(hex, alpha) {
  const value = hex.replace('#', '')
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const TYPE_STYLES = {
  string: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  number: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  integer: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  boolean: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  date: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  datetime: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  enum: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  ref: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  array: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
}

export function typeStyle(type) {
  return TYPE_STYLES[type] ?? 'bg-muted text-muted-foreground'
}
