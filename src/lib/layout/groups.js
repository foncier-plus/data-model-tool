import { namespaceParent } from '@/lib/model/hierarchy'
import { NAMESPACE_PADDING, NS_HEADER_HEIGHT } from './constants.js'

export function isUnderNamespace(namespace, ancestor) {
  if (!namespace || !ancestor) return false
  return namespace === ancestor || namespace.startsWith(`${ancestor}.`)
}

export function computeGroupRects(objects) {
  const groups = new Map()

  const ensure = (fullName) => {
    if (!fullName) return null
    const existing = groups.get(fullName)
    if (existing) return existing
    const node = { fullName, parent: namespaceParent(fullName), children: new Set(), objects: [] }
    groups.set(fullName, node)
    const parent = ensure(node.parent)
    if (parent) parent.children.add(fullName)
    return node
  }

  for (const object of objects) {
    const group = object.namespace ? ensure(object.namespace) : null
    if (group) group.objects.push(object)
  }

  const rects = new Map()

  const compute = (group) => {
    for (const child of group.children) compute(groups.get(child))

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    const consider = (x, y, width, height) => {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + width)
      maxY = Math.max(maxY, y + height)
    }

    for (const object of group.objects) {
      consider(object.x, object.y, object.width, object.height)
    }
    for (const child of group.children) {
      const rect = rects.get(child)
      if (rect) consider(rect.x, rect.y, rect.width, rect.height)
    }

    if (!Number.isFinite(minX)) return

    rects.set(group.fullName, {
      fullName: group.fullName,
      parent: group.parent,
      x: minX - NAMESPACE_PADDING,
      y: minY - NAMESPACE_PADDING - NS_HEADER_HEIGHT,
      width: maxX - minX + NAMESPACE_PADDING * 2,
      height: maxY - minY + NAMESPACE_PADDING * 2 + NS_HEADER_HEIGHT,
    })
  }

  for (const group of groups.values()) {
    if (!group.parent) compute(group)
  }

  return rects
}
