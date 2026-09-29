import { normalizeComments } from './comments.js'

export function serializeObject(doc) {
  normalizeComments(doc)
  return doc.toString({ flowCollectionPadding: false, lineWidth: 0 })
}

export function serializeObjects(docs) {
  const parts = docs.map((doc) =>
    serializeObject(doc)
      .replace(/^---\n/, '')
      .replace(/\n$/, ''),
  )
  return `${parts.join('\n---\n')}\n`
}

function scalar(value) {
  const text = String(value ?? '')
  return /^[A-Za-z0-9_. /+()&',-]+$/.test(text) ? text : JSON.stringify(text)
}

export function blankObjectFile(name, namespace = '') {
  const lines = []
  if (namespace) lines.push(`namespace: ${scalar(namespace)}`)
  lines.push(`name: ${scalar(name)}`, 'description:', 'about:', 'attributes: []', 'groups: []')
  return `${lines.join('\n')}\n`
}
