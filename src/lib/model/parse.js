import YAML from 'yaml'
import { normalizeComments, readComment } from './comments.js'
import { validateModel } from './schema.js'

function asString(value) {
  return typeof value === 'string' ? value : ''
}

function asText(value) {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : String(value)
}

function asArray(node) {
  return Array.isArray(node?.items) ? node.items : []
}

function originFromNode(node) {
  if (!node || typeof node.get !== 'function') return undefined
  const formula = asString(node.get('formula'))
  const list = asArray(node.get('from'))
    .map((item) => (item && typeof item === 'object' ? item.value : item))
    .filter((item) => item !== undefined && item !== null)
    .map((item) => String(item))
  if (list.length === 0 && !formula) return undefined
  return { from: list, formula }
}

function attributeFromNode(node) {
  if (!node || typeof node.get !== 'function') return null
  const name = asString(node.get('name'))
  if (!name) return null
  const presence = asString(node.get('presence')).trim().toLowerCase()
  const optional = presence ? presence === 'optional' : node.get('optional') === true
  const attribute = {
    name,
    presence: optional ? 'optional' : 'mandatory',
    optional,
    example: asText(node.get('example')),
    description: asString(node.get('description')),
    about: asString(node.get('about')),
    comment: readComment(node),
  }
  const type = asString(node.get('type'))
  if (type) attribute.type = type
  const origin = originFromNode(node.get('origin'))
  if (origin) attribute.origin = origin
  return attribute
}

function groupFromNode(node) {
  if (!node || typeof node.get !== 'function') return null
  const name = asString(node.get('name'))
  if (!name) return null
  const group = {
    name,
    description: asString(node.get('description')),
    comment: readComment(node),
    attributes: [],
  }
  const origin = originFromNode(node.get('origin'))
  if (origin) group.origin = origin
  group.attributes = asArray(node.get('attributes')).map(attributeFromNode).filter(Boolean)
  return group
}

export function toRawObject(doc) {
  const root = doc.contents
  if (!root || typeof root.get !== 'function') return {}

  const object = {
    name: asString(root.get('name')),
    namespace: asString(root.get('namespace')),
    type: asString(root.get('type')),
    description: asString(root.get('description')),
    about: asString(root.get('about')),
    comment: readComment(root.items?.[0]?.key),
    attributes: [],
    groups: [],
  }

  object.attributes = asArray(root.get('attributes')).map(attributeFromNode).filter(Boolean)
  object.groups = asArray(root.get('groups')).map(groupFromNode).filter(Boolean)

  return object
}

export function deriveModel(doc) {
  const raw = toRawObject(doc)
  const { model, issues } = validateModel(raw)
  const errors = issues.map((issue) =>
    issue.path ? `${issue.path}: ${issue.message}` : issue.message,
  )
  return { raw, model, errors }
}

export function normalizeNamespace(namespace) {
  return String(namespace ?? '')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('.')
}

export function entryIdentity(namespace, name) {
  const prefix = normalizeNamespace(namespace)
  const label = String(name ?? '').trim()
  return prefix ? `${prefix}.${label}` : label
}

function lineOf(text, offset) {
  const limit = Math.min(offset, text.length)
  let line = 1
  for (let index = 0; index < limit; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1
  }
  return line
}

export function collectLines(doc, text) {
  const root = doc.contents
  const lines = { object: 1, groups: {}, attributes: {}, groupAttributes: {} }
  if (!root || typeof root.get !== 'function') return lines
  if (Array.isArray(root.range)) lines.object = lineOf(text, root.range[0])

  const attributes = root.get('attributes')
  if (Array.isArray(attributes?.items)) {
    for (const item of attributes.items) {
      const name = item?.get?.('name')
      if (name !== undefined && Array.isArray(item?.range)) {
        lines.attributes[String(name)] = lineOf(text, item.range[0])
      }
    }
  }

  const groups = root.get('groups')
  if (Array.isArray(groups?.items)) {
    for (const group of groups.items) {
      const groupName = group?.get?.('name')
      if (groupName !== undefined && Array.isArray(group?.range)) {
        lines.groups[String(groupName)] = lineOf(text, group.range[0])
      }
      const groupAttributes = group?.get?.('attributes')
      if (groupName !== undefined && Array.isArray(groupAttributes?.items)) {
        for (const item of groupAttributes.items) {
          const name = item?.get?.('name')
          if (name !== undefined && Array.isArray(item?.range)) {
            lines.groupAttributes[`${groupName}.${name}`] = lineOf(text, item.range[0])
          }
        }
      }
    }
  }

  return lines
}

export function parseObjectDocument(fileName, doc, docIndex) {
  normalizeComments(doc)
  const { raw, model, errors } = deriveModel(doc)
  const namespace = normalizeNamespace(raw.namespace)
  const name = model?.name ?? raw.name ?? ''
  const parseErrors = doc.errors.map((error) => error.message)
  return {
    fileName,
    docIndex,
    doc,
    raw,
    model,
    namespace: namespace || null,
    qualifiedName: entryIdentity(namespace, name),
    errors: [...parseErrors, ...errors],
  }
}

export function parseObjectFile(fileName, text) {
  const source = text ?? ''
  const docs = YAML.parseAllDocuments(source, { keepSourceTokens: false })
  const list = docs.length > 0 ? docs : [YAML.parseDocument('')]
  const entries = list.map((doc, docIndex) => {
    const entry = parseObjectDocument(fileName, doc, docIndex)
    entry.lines = collectLines(doc, source)
    return entry
  })
  return { fileName, docs: list, entries }
}
