const KIND_PRIORITY = { attribute: 0, group: 1, object: 2 }

export function entryName(entry) {
  return entry?.qualifiedName ?? entry?.model?.name ?? ''
}

export function objectRef(qualifiedName) {
  return qualifiedName
}

export function groupRef(qualifiedName, groupName) {
  return `${qualifiedName}.${groupName}`
}

export function attributeRef(qualifiedName, _groupName, attributeName) {
  return `${qualifiedName}.${attributeName}`
}

export function objectElements(model) {
  const elements = new Set()
  for (const attribute of model.attributes ?? []) {
    elements.add(attribute.name)
  }
  for (const group of model.groups ?? []) {
    elements.add(group.name)
    for (const attribute of group.attributes ?? []) {
      elements.add(attribute.name)
    }
  }
  return [...elements]
}

export function elementOwnerRef(element) {
  if (!element) return null
  if (element.kind === 'attribute' && element.groupName) {
    return groupRef(element.objectName, element.groupName)
  }
  return element.objectName
}

export function collectOrigins(model, qualifiedName = model.name) {
  const origins = []
  for (const attribute of model.attributes ?? []) {
    if (attribute.origin) {
      origins.push({
        ref: attributeRef(qualifiedName, null, attribute.name),
        kind: 'attribute',
        name: attribute.name,
        origin: attribute.origin,
      })
    }
  }
  for (const group of model.groups ?? []) {
    if (group.origin) {
      origins.push({
        ref: groupRef(qualifiedName, group.name),
        kind: 'group',
        name: group.name,
        origin: group.origin,
      })
    }
    for (const attribute of group.attributes ?? []) {
      if (attribute.origin) {
        origins.push({
          ref: attributeRef(qualifiedName, group.name, attribute.name),
          kind: 'attribute',
          name: attribute.name,
          origin: attribute.origin,
        })
      }
    }
  }
  return origins
}

export function buildIndex(objects) {
  const index = new Map()
  const add = (ref, element) => {
    const list = index.get(ref)
    if (list) list.push(element)
    else index.set(ref, [element])
  }

  for (const entry of objects) {
    const { model } = entry
    if (!model) continue
    const name = entryName(entry)
    add(objectRef(name), {
      ref: objectRef(name),
      kind: 'object',
      objectName: name,
      model,
    })
    for (const attribute of model.attributes ?? []) {
      add(attributeRef(name, null, attribute.name), {
        ref: attributeRef(name, null, attribute.name),
        kind: 'attribute',
        objectName: name,
        groupName: null,
        attributeName: attribute.name,
        model,
      })
    }
    for (const group of model.groups ?? []) {
      add(groupRef(name, group.name), {
        ref: groupRef(name, group.name),
        kind: 'group',
        objectName: name,
        groupName: group.name,
        model,
      })
      for (const attribute of group.attributes ?? []) {
        add(attributeRef(name, group.name, attribute.name), {
          ref: attributeRef(name, group.name, attribute.name),
          kind: 'attribute',
          objectName: name,
          groupName: group.name,
          attributeName: attribute.name,
          model,
        })
      }
    }
  }

  return index
}

function pick(candidates) {
  return [...candidates].sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind])[0]
}

function projectOf(objectName) {
  if (!objectName) return null
  const dot = objectName.indexOf('.')
  return dot === -1 ? objectName : objectName.slice(0, dot)
}

function resolveScoped(index, key, project) {
  const candidates = index.get(key)
  if (!candidates || candidates.length === 0) return null
  if (!project) return pick(candidates)
  const scoped = candidates.filter((candidate) => projectOf(candidate.objectName) === project)
  return scoped.length ? pick(scoped) : null
}

export function resolveRef(ref, index, namespace = null) {
  if (!ref) return null
  if (!namespace) return resolveScoped(index, ref, null)

  const project = namespace.split('.')[0]
  const sameNamespace = resolveScoped(index, `${namespace}.${ref}`, project)
  if (sameNamespace) return sameNamespace
  const projectScoped = resolveScoped(index, `${project}.${ref}`, project)
  if (projectScoped) return projectScoped
  // Fully qualified cross-project reference, e.g. IGN.BDTOPO.batiment.hauteur.
  const head = ref.split('.')[0]
  const absolute = resolveScoped(index, ref, head)
  if (absolute) return absolute
  return null
}

export function findObjectConflicts(objects) {
  const byName = new Map()
  for (const entry of objects) {
    if (!entry.model) continue
    const name = entryName(entry)
    if (!name) continue
    const files = byName.get(name) ?? new Set()
    files.add(entry.fileName)
    byName.set(name, files)
  }
  const conflicts = new Map()
  for (const [name, files] of byName) {
    if (files.size > 1) conflicts.set(name, [...files])
  }
  return conflicts
}

export function findElement(index, objectName, groupName, attributeName) {
  if (attributeName) return resolveRef(attributeRef(objectName, groupName, attributeName), index)
  if (groupName) return resolveRef(groupRef(objectName, groupName), index)
  return resolveRef(objectName, index)
}

export function validateReferences(objects) {
  const index = buildIndex(objects)
  const issues = []

  for (const [name, files] of findObjectConflicts(objects)) {
    issues.push({
      code: 'conflict',
      ref: name,
      file: files[0],
      files,
      message: `Objet "${name}" déclaré dans plusieurs fichiers : ${files.join(', ')}`,
    })
  }

  for (const entry of objects) {
    const { model } = entry
    if (!model) continue
    const name = entryName(entry)

    const names = new Set()
    for (const attribute of model.attributes ?? []) {
      if (names.has(attribute.name)) {
        issues.push({ code: 'duplicate', ref: attributeRef(name, null, attribute.name), file: entry.fileName, message: `Duplicate attribute "${attribute.name}" in ${model.name}` })
      }
      names.add(attribute.name)
    }
    const groupNames = new Set()
    for (const group of model.groups ?? []) {
      if (groupNames.has(group.name)) {
        issues.push({ code: 'duplicate', ref: groupRef(name, group.name), file: entry.fileName, message: `Duplicate group "${group.name}" in ${model.name}` })
      }
      groupNames.add(group.name)
      const inner = new Set()
      for (const attribute of group.attributes ?? []) {
        if (inner.has(attribute.name)) {
          issues.push({ code: 'duplicate', ref: attributeRef(name, group.name, attribute.name), file: entry.fileName, message: `Duplicate attribute "${attribute.name}" in ${model.name}.${group.name}` })
        }
        inner.add(attribute.name)
      }
    }

    for (const source of collectOrigins(model, name)) {
      for (const ref of source.origin.from ?? []) {
        const resolved = resolveRef(ref, index, entry.namespace ?? null)
        if (!resolved) {
          issues.push({
            code: 'unresolved',
            ref: source.ref,
            message: `${source.ref} references unknown "${ref}"`,
            from: ref,
            file: entry.fileName,
          })
          continue
        }
        if (resolved.ref === source.ref) {
          issues.push({
            code: 'self',
            ref: source.ref,
            message: `${source.ref} references itself`,
            from: ref,
            file: entry.fileName,
          })
        }
      }
    }
  }

  issues.push(...detectCycles(objects, index))
  return issues
}

function detectCycles(objects, index) {
  const issues = []
  const edges = new Map()
  const nodes = new Set()
  const fileByRef = new Map()

  for (const entry of objects) {
    const { model } = entry
    if (!model) continue
    for (const source of collectOrigins(model, entryName(entry))) {
      nodes.add(source.ref)
      fileByRef.set(source.ref, entry.fileName)
      const targets = edges.get(source.ref) ?? []
      for (const ref of source.origin.from ?? []) {
        const resolved = resolveRef(ref, index, entry.namespace ?? null)
        if (!resolved || resolved.kind === 'object') continue
        nodes.add(resolved.ref)
        targets.push(resolved.ref)
      }
      edges.set(source.ref, targets)
    }
  }

  const state = new Map()
  const reported = new Set()
  const visit = (node, stack) => {
    state.set(node, 'visiting')
    for (const next of edges.get(node) ?? []) {
      if (state.get(next) === 'visiting') {
        const cycle = [...stack.slice(stack.indexOf(next)), next]
        const key = [...cycle].sort().join('|')
        if (!reported.has(key)) {
          reported.add(key)
          issues.push({
            code: 'cycle',
            ref: node,
            file: fileByRef.get(node) ?? null,
            message: `Cycle detected: ${cycle.join(' → ')}`,
          })
        }
        continue
      }
      if (!state.has(next)) visit(next, [...stack, next])
    }
    state.set(node, 'done')
  }

  for (const node of nodes) {
    if (!state.has(node)) visit(node, [node])
  }

  return issues
}
