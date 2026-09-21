export function findEntryByObjectName(entries, objectName) {
  return (
    entries.find(
      (entry) => (entry.qualifiedName ?? entry.model?.name) === objectName,
    ) ?? null
  )
}

export function resolveSelection(entries, selection) {
  if (!selection) return null
  const entry = findEntryByObjectName(entries, selection.objectName)
  if (!entry?.model) return null
  const model = entry.model

  if (selection.kind === 'object') {
    return { entry, model, groupIndex: null, group: null, attributeIndex: null, attribute: null }
  }

  const groupIndex = selection.groupName
    ? model.groups.findIndex((group) => group.name === selection.groupName)
    : -1
  const group = groupIndex >= 0 ? model.groups[groupIndex] : null

  if (selection.kind === 'group') {
    return {
      entry,
      model,
      groupIndex: groupIndex >= 0 ? groupIndex : null,
      group,
      attributeIndex: null,
      attribute: null,
    }
  }

  const list = group ? group.attributes : model.attributes
  const attributeIndex = list.findIndex((attribute) => attribute.name === selection.attributeName)
  return {
    entry,
    model,
    groupIndex: groupIndex >= 0 ? groupIndex : null,
    group,
    attributeIndex: attributeIndex >= 0 ? attributeIndex : null,
    attribute: attributeIndex >= 0 ? list[attributeIndex] : null,
  }
}
