import YAML from 'yaml'
import { applyOrdering } from './mutations.js'

function mappingKey(line) {
  const match = line.trim().match(/^([^#\s][^:]*):(\s|$)/)
  return match ? match[1].trim() : null
}

function formatDocument(doc) {
  applyOrdering(doc)
  const text = doc.toString({ flowCollectionPadding: false, lineWidth: 0 })
  const lines = text.replace(/\n+$/, '').split('\n')
  const out = []
  const stack = []
  const counts = new Map()

  const pushBlank = () => {
    if (out.length > 0 && out[out.length - 1] !== '') out.push('')
  }

  for (const line of lines) {
    if (line.trim() === '') continue
    const indent = line.length - line.trimStart().length
    const trimmed = line.trim()

    if (/^-\s/.test(trimmed)) {
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop()
      const parent = stack[stack.length - 1] ?? null
      if (parent && (parent.key === 'attributes' || parent.key === 'groups')) {
        const id = `${parent.indent}:${parent.key}`
        const count = counts.get(id) ?? 0
        if (count > 0) pushBlank()
        counts.set(id, count + 1)
      }
      out.push(line)
      continue
    }

    const key = mappingKey(line)
    if (key) {
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop()
      if (key === 'attributes' || key === 'groups') pushBlank()
      stack.push({ indent, key })
      out.push(line)
      continue
    }

    out.push(line)
  }

  return out.join('\n')
}

export function prettifyFile(text) {
  const docs = YAML.parseAllDocuments(text ?? '')
  const list = docs.length > 0 ? docs : [YAML.parseDocument('')]
  const parts = list
    .map((doc) => formatDocument(doc))
    .filter((part) => part.trim() !== '')
  if (parts.length === 0) return text ?? ''
  return `${parts.join('\n---\n')}\n`
}
