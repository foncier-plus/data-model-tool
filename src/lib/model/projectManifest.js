import YAML from 'yaml'

function asStringList(value) {
  if (value === undefined || value === null) return { list: [], invalid: false }
  if (!Array.isArray(value)) return { list: [], invalid: true }
  const list = value
    .filter((item) => item !== undefined && item !== null)
    .map((item) => String(item).trim())
    .filter(Boolean)
  return { list, invalid: false }
}

// Parse a `.project.yaml` manifest. Returns the declared fields plus a list of
// structured errors (codes are translated by the view).
export function parseProjectManifest(fileName, text) {
  const errors = []
  const doc = YAML.parseDocument(text ?? '')
  for (const error of doc.errors) errors.push({ code: 'yaml', message: error.message })

  let data
  try {
    data = doc.toJS()
  } catch (error) {
    errors.push({ code: 'yaml', message: error.message })
    data = null
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    if (data !== undefined && data !== null) errors.push({ code: 'notObject' })
    return { fileName, title: '', description: '', include: [], exclude: [], errors }
  }

  const title = typeof data.title === 'string' ? data.title.trim() : ''
  if (!title) errors.push({ code: 'titleRequired' })

  const description = typeof data.description === 'string' ? data.description : ''
  const include = asStringList(data.include)
  if (include.invalid) errors.push({ code: 'includeInvalid' })
  const exclude = asStringList(data.exclude)
  if (exclude.invalid) errors.push({ code: 'excludeInvalid' })

  return {
    fileName,
    title,
    description,
    include: include.list,
    exclude: exclude.list,
    errors,
  }
}

function matchPatterns(patterns, names) {
  const matched = new Set()
  const unmatched = []
  for (const pattern of patterns) {
    let hits
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2)
      const prefixDot = `${prefix}.`
      hits = prefix ? [...names].filter((name) => name.startsWith(prefixDot)) : [...names]
    } else {
      hits = names.has(pattern) ? [pattern] : []
    }
    if (hits.length === 0) unmatched.push(pattern)
    else for (const name of hits) matched.add(name)
  }
  return { matched, unmatched }
}

// Resolve include/exclude patterns against the object entries.
// `NS.Object` matches an exact object; `NS.*` matches the namespace subtree.
export function resolveProjectPatterns(entries, include = [], exclude = []) {
  const names = new Set()
  for (const entry of entries) {
    if (entry?.qualifiedName) names.add(entry.qualifiedName)
  }

  const errors = []
  const included = matchPatterns(include, names)
  for (const pattern of included.unmatched) {
    errors.push({ code: 'includeNoMatch', pattern })
  }

  const excluded = matchPatterns(exclude, names)
  for (const pattern of excluded.unmatched) {
    errors.push({ code: 'excludeNoMatch', pattern })
  }

  const ids = new Set(included.matched)
  for (const name of excluded.matched) ids.delete(name)

  return { ids, errors }
}
