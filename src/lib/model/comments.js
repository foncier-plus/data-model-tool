export function readComment(node) {
  const raw = node?.commentBefore
  if (typeof raw !== 'string' || !raw) return ''
  return raw
    .split('\n')
    .map((line) => line.replace(/^ /, ''))
    .join('\n')
    .trim()
}

export function writeComment(node, text) {
  if (!node || typeof node !== 'object') return
  const value = (text ?? '').replace(/\r\n/g, '\n').trim()
  if (!value) {
    node.commentBefore = null
    return
  }
  node.commentBefore = value
    .split('\n')
    .map((line) => (line ? ` ${line}` : ' '))
    .join('\n')
}

function sequenceOf(node) {
  if (!node || !Array.isArray(node.items)) return null
  return node
}

export function normalizeComments(doc) {
  const sequences = [doc.get('attributes'), doc.get('groups')]
  const groups = doc.get('groups')
  if (Array.isArray(groups?.items)) {
    for (const group of groups.items) {
      sequences.push(group?.get?.('attributes'))
    }
  }

  for (const candidate of sequences) {
    const seq = sequenceOf(candidate)
    if (!seq || seq.items.length === 0) continue
    const seqComment = readComment(seq)
    if (!seqComment) continue
    const first = seq.items[0]
    const firstComment = readComment(first)
    writeComment(first, [seqComment, firstComment].filter(Boolean).join('\n'))
    seq.commentBefore = null
  }
}
