import YAML from 'yaml'

const ORDER = ['title', 'description', 'include', 'exclude']

function ensureMap(doc) {
  if (!doc.contents || typeof doc.contents.set !== 'function') {
    doc.contents = doc.createNode({})
  }
}

function orderMap(doc) {
  const map = doc.contents
  if (!Array.isArray(map?.items)) return
  const rank = (key) => {
    const index = ORDER.indexOf(key)
    return index === -1 ? ORDER.length : index
  }
  map.items.sort((a, b) => rank(a?.key?.value) - rank(b?.key?.value))
}

function serialize(doc) {
  return doc.toString({ flowCollectionPadding: false, lineWidth: 0 })
}

export function setProjectField(text, key, value) {
  const doc = YAML.parseDocument(text ?? '')
  ensureMap(doc)
  if (value === '' || value === null || value === undefined) doc.delete(key)
  else doc.set(key, value)
  orderMap(doc)
  return serialize(doc)
}

export function setProjectList(text, key, items) {
  const doc = YAML.parseDocument(text ?? '')
  ensureMap(doc)
  const list = (items ?? []).map((item) => String(item).trim()).filter(Boolean)
  if (list.length === 0) doc.delete(key)
  else doc.set(key, list)
  orderMap(doc)
  return serialize(doc)
}
