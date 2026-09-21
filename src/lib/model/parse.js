import YAML from 'yaml'
import { normalizeComments, readComment } from './comments.js'
import { validateModel } from './schema.js'

function asString(value) {
  return typeof value === 'string' ? value : ''
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
  const attribute = {
    name,
    optional: node.get('optional') === true,
    example: asString(node.get('example')),
    description: asString(node.get('description')),
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
    description: asString(root.get('description')),
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

export function parseObjectFile(fileName, text) {
  const doc = YAML.parseDocument(text ?? '', { keepSourceTokens: false })
  normalizeComments(doc)

  const parseErrors = doc.errors.map((error) => error.message)
  const { raw, model, errors } = deriveModel(doc)

  return { fileName, doc, raw, model, errors: [...parseErrors, ...errors] }
}
