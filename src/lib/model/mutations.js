import { writeComment } from './comments.js'

const OBJECT_ORDER = ['name', 'type', 'description', 'attributes', 'groups']
const GROUP_ORDER = ['name', 'description', 'origin', 'attributes']
const ATTRIBUTE_ORDER = ['name', 'type', 'optional', 'example', 'description', 'origin']
const ORIGIN_ORDER = ['from', 'formula']

function findPair(map, key) {
  return map?.items?.find((pair) => pair?.key?.value === key)
}

function orderPairs(map, order) {
  if (!Array.isArray(map?.items)) return
  const rank = (key) => {
    const index = order.indexOf(key)
    return index === -1 ? order.length : index
  }
  map.items.sort((a, b) => rank(a?.key?.value) - rank(b?.key?.value))
}

function setScalar(doc, map, key, value) {
  const isEmpty = value === undefined || value === null || value === ''
  const pair = findPair(map, key)
  if (isEmpty) {
    if (pair) map.delete(key)
    return
  }
  if (pair) {
    if (pair.value && typeof pair.value === 'object' && 'value' in pair.value) {
      pair.value.value = value
    } else {
      pair.value = doc.createNode(value)
    }
    return
  }
  map.set(key, value)
}

function setOriginOnNode(doc, node, origin) {
  const from = Array.isArray(origin?.from) ? origin.from.filter(Boolean) : []
  const formula = typeof origin?.formula === 'string' ? origin.formula : ''

  if (from.length === 0 && !formula.trim()) {
    node.delete('origin')
    return
  }

  let map = node.get('origin')
  if (!map || typeof map.set !== 'function') {
    map = doc.createNode({})
    node.set('origin', map)
  }

  if (from.length > 0) {
    let seq = map.get('from')
    if (!Array.isArray(seq?.items)) {
      seq = doc.createNode([])
      seq.flow = true
      map.set('from', seq)
    }
    seq.items = from.map((ref) => doc.createNode(ref))
  } else {
    map.delete('from')
  }

  setScalar(doc, map, 'formula', formula)
  orderPairs(map, ORIGIN_ORDER)
}

function uniqueName(seq, base) {
  const existing = new Set(
    (seq?.items ?? []).map((item) => item?.get?.('name')).filter(Boolean),
  )
  if (!existing.has(base)) return base
  let index = 2
  while (existing.has(`${base}_${index}`)) index += 1
  return `${base}_${index}`
}

function getGroupNode(doc, groupIndex) {
  return doc.getIn(['groups', groupIndex])
}

function getAttributeSequence(doc, groupIndex) {
  if (groupIndex === null || groupIndex === undefined) {
    const seq = doc.get('attributes')
    return Array.isArray(seq?.items) ? seq : null
  }
  const group = getGroupNode(doc, groupIndex)
  const seq = group?.get?.('attributes')
  return Array.isArray(seq?.items) ? seq : null
}

function ensureAttributeSequence(doc, groupIndex) {
  if (groupIndex === null || groupIndex === undefined) {
    let seq = doc.get('attributes')
    if (!Array.isArray(seq?.items)) {
      seq = doc.createNode([])
      doc.set('attributes', seq)
    }
    return seq
  }
  const group = getGroupNode(doc, groupIndex)
  if (!group) throw new Error(`Unknown group index: ${groupIndex}`)
  let seq = group.get('attributes')
  if (!Array.isArray(seq?.items)) {
    seq = doc.createNode([])
    group.set('attributes', seq)
  }
  return seq
}

function pruneSequence(doc, groupIndex, seq) {
  if (seq.items.length > 0) return
  if (groupIndex === null || groupIndex === undefined) {
    doc.delete('attributes')
    return
  }
  getGroupNode(doc, groupIndex)?.delete?.('attributes')
}

export function addAttribute(doc, groupIndex = null, name) {
  const seq = ensureAttributeSequence(doc, groupIndex)
  const node = doc.createNode({
    name: uniqueName(seq, name || 'new_attribute'),
    type: 'string',
    description: '',
  })
  seq.add(node)
  return seq.items.length - 1
}

export function removeAttribute(doc, groupIndex, attributeIndex) {
  const seq = getAttributeSequence(doc, groupIndex)
  if (!seq || !seq.items[attributeIndex]) return
  seq.items.splice(attributeIndex, 1)
  pruneSequence(doc, groupIndex, seq)
}

export function moveAttribute(doc, fromGroupIndex, attributeIndex, toGroupIndex) {
  if (fromGroupIndex === toGroupIndex) return
  const fromSeq = getAttributeSequence(doc, fromGroupIndex)
  const node = fromSeq?.items?.[attributeIndex]
  if (!node) return
  fromSeq.items.splice(attributeIndex, 1)
  pruneSequence(doc, fromGroupIndex, fromSeq)
  ensureAttributeSequence(doc, toGroupIndex).add(node)
}

export function setAttributeField(doc, groupIndex, attributeIndex, key, value) {
  const seq = getAttributeSequence(doc, groupIndex)
  const item = seq?.items?.[attributeIndex]
  if (!item) return
  if (key === 'comment') {
    writeComment(item, value)
    return
  }
  if (key === 'optional') {
    if (value) setScalar(doc, item, 'optional', true)
    else item.delete('optional')
    orderPairs(item, ATTRIBUTE_ORDER)
    return
  }
  if (key === 'origin') {
    setOriginOnNode(doc, item, value)
    orderPairs(item, ATTRIBUTE_ORDER)
    return
  }
  setScalar(doc, item, key, value)
  orderPairs(item, ATTRIBUTE_ORDER)
}

export function addGroup(doc, name) {
  let seq = doc.get('groups')
  if (!Array.isArray(seq?.items)) {
    seq = doc.createNode([])
    doc.set('groups', seq)
  }
  const node = doc.createNode({
    name: uniqueName(seq, name || 'new_group'),
    description: '',
  })
  seq.add(node)
  return seq.items.length - 1
}

export function removeGroup(doc, groupIndex) {
  const seq = doc.get('groups')
  if (!Array.isArray(seq?.items) || !seq.items[groupIndex]) return
  seq.items.splice(groupIndex, 1)
  if (seq.items.length === 0) doc.delete('groups')
}

export function setGroupField(doc, groupIndex, key, value) {
  const group = getGroupNode(doc, groupIndex)
  if (!group) return
  if (key === 'comment') {
    writeComment(group, value)
    return
  }
  if (key === 'origin') {
    setOriginOnNode(doc, group, value)
    orderPairs(group, GROUP_ORDER)
    return
  }
  setScalar(doc, group, key, value)
  orderPairs(group, GROUP_ORDER)
}

export function setObjectField(doc, key, value) {
  if (!doc.contents || typeof doc.contents.set !== 'function') return
  if (key === 'comment') {
    writeComment(doc.contents.items?.[0]?.key, value)
    return
  }
  setScalar(doc, doc.contents, key, value)
  orderPairs(doc.contents, OBJECT_ORDER)
}

export function getObjectName(doc) {
  return doc.get('name') ?? ''
}
