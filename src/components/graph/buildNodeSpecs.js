import { namespaceLabel } from '@/lib/model/hierarchy'
import { colorFor } from '@/lib/colors'
import { COLLAPSED_GROUP_HEIGHT, COLLAPSED_GROUP_WIDTH, NODE_WIDTH } from '@/lib/layout'
import { DEPENDENCY_WIDTH } from './graphConstants'

// Build the React Flow node specifications from the visible graph.
export function buildNodeSpecs({
  previous,
  visible,
  groupRects,
  namespaceCounts,
  positions,
  internalIds,
  showParentObjects,
  selectedId,
  relatedObjects,
  edgeMode,
  revealRefs,
  linkedRefs,
  autoCollapse,
  attributeRelations,
  rootGroup,
  index,
  toggleGroup,
}) {
  const byId = new Map(previous.map((node) => [node.id, node]))
  const specs = []

  for (const [fullName, rect] of groupRects) {
    if (visible.collapsedGroupIds.has(fullName)) continue
    const id = `ns:${fullName}`
    const existing = byId.get(id)
    specs.push({
      ...existing,
      id,
      type: 'namespace',
      selectable: false,
      position: { x: rect.x, y: rect.y },
      style: { width: rect.width, height: rect.height, pointerEvents: 'none' },
      zIndex: 0,
      data: {
        ...existing?.data,
        label: namespaceLabel(fullName),
        namespace: fullName,
        collapsed: false,
        count: namespaceCounts.get(fullName) ?? 0,
        edgeMode,
        onToggle: toggleGroup,
      },
    })
  }

  for (const namespace of visible.collapsedGroupIds) {
    const id = `ns:${namespace}`
    const existing = byId.get(id)
    specs.push({
      ...existing,
      id,
      type: 'namespace',
      selectable: false,
      position: positions.get(id),
      style: {
        width: COLLAPSED_GROUP_WIDTH,
        height: COLLAPSED_GROUP_HEIGHT,
        pointerEvents: 'none',
      },
      zIndex: 0,
      data: {
        ...existing?.data,
        label: namespaceLabel(namespace),
        namespace,
        collapsed: true,
        count: namespaceCounts.get(namespace) ?? 0,
        edgeMode,
        onToggle: toggleGroup,
      },
    })
  }

  for (const object of visible.objectNodes) {
    const existing = byId.get(object.id)
    const external = Boolean(internalIds && !internalIds.has(object.id))
    const condensed = external && !showParentObjects

    if (condensed) {
      specs.push({
        ...existing,
        id: object.id,
        type: 'dependency',
        selectable: true,
        position: positions.get(object.id),
        style: { width: DEPENDENCY_WIDTH },
        zIndex: 1,
        measured: existing?.measured,
        data: {
          ...existing?.data,
          label: object.model?.name ?? object.id,
          qualifiedName: object.id,
          namespace: object.namespace ?? null,
          color: colorFor(object.id),
          highlighted: object.id === selectedId,
          dimmed: Boolean(selectedId) && !relatedObjects.has(object.id),
          external,
        },
      })
      continue
    }

    specs.push({
      ...existing,
      id: object.id,
      type: 'entity',
      position: positions.get(object.id),
      style: { width: NODE_WIDTH },
      zIndex: 1,
      measured: existing?.measured,
      data: {
        ...existing?.data,
        model: object.model,
        qualifiedName: object.id,
        namespace: object.namespace ?? null,
        fileName: object.fileName ?? null,
        conflict: object.conflict ?? false,
        files: object.files ?? null,
        revealOnClick: true,
        index,
        color: colorFor(object.id),
        edgeMode,
        revealRefs,
        linkedRefs,
        autoCollapse,
        attributeRelations,
        rootGroup,
        external,
      },
    })
  }

  return specs
}
