import { normalizeComments } from './comments.js'

export function serializeObject(doc) {
  normalizeComments(doc)
  return doc.toString({ flowCollectionPadding: false, lineWidth: 0 })
}

export function blankObjectFile(name) {
  return [
    `name: ${name}`,
    'description:',
    'attributes: []',
    'groups: []',
    '',
  ].join('\n')
}
