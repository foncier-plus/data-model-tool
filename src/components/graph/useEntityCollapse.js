import { useState } from 'react'
import { attributeRef, groupRef } from '@/lib/model/refs'

// Collapse/expand state for an entity node, including the auto-expansion of the
// groups/attributes related to the current reveal.
export function useEntityCollapse({
  model,
  qualifiedName,
  rootAttributes,
  revealRefs,
  linkedRefs,
  highlighted,
  autoCollapse,
  attributeRelations,
}) {
  const [expanded, setExpanded] = useState(() => new Set())
  const [manualCollapsed, setManualCollapsed] = useState(() => new Set())
  const [manualRootCollapsed, setManualRootCollapsed] = useState(false)
  const [rootCollapsed, setRootCollapsed] = useState(true)
  const [lastReveal, setLastReveal] = useState('')
  const [autoGroups, setAutoGroups] = useState(() => new Set())
  const [autoRoot, setAutoRoot] = useState(false)

  const revealKey = revealRefs?.size ? [...revealRefs].sort().join('|') : ''
  if (revealKey !== lastReveal) {
    setLastReveal(revealKey)
    if (!highlighted && autoCollapse && !attributeRelations) {
      if (!revealKey) {
        setExpanded((previous) => {
          const next = new Set(previous)
          for (const ref of autoGroups) next.delete(ref)
          return next
        })
        setAutoGroups(new Set())
        if (autoRoot) setRootCollapsed(true)
        setAutoRoot(false)
      } else {
        const nextAuto = new Set()
        for (const group of model.groups ?? []) {
          const hasReveal = (group.attributes ?? []).some((attribute) =>
            revealRefs?.has(attributeRef(qualifiedName, group.name, attribute.name)),
          )
          if (hasReveal) nextAuto.add(groupRef(qualifiedName, group.name))
        }
        const revealRoot = rootAttributes.some((attribute) =>
          revealRefs?.has(attributeRef(qualifiedName, null, attribute.name)),
        )

        if (nextAuto.size > 0 || revealRoot) {
          setExpanded((previous) => {
            const next = new Set(previous)
            for (const ref of autoGroups) {
              if (!nextAuto.has(ref)) next.delete(ref)
            }
            for (const ref of nextAuto) next.add(ref)
            return next
          })
          setAutoGroups(nextAuto)
          if (revealRoot) setRootCollapsed(false)
          else if (autoRoot) setRootCollapsed(true)
          setAutoRoot(revealRoot)
        } else {
          setExpanded(new Set())
          setAutoGroups(new Set())
          setRootCollapsed(true)
          setAutoRoot(false)
        }
      }
    }
  }

  const rootLinked =
    attributeRelations &&
    rootAttributes.some((attribute) =>
      linkedRefs?.has(attributeRef(qualifiedName, null, attribute.name)),
    )
  const rootIsCollapsed = rootLinked
    ? false
    : autoCollapse
      ? rootCollapsed
      : manualRootCollapsed

  const toggleRoot = () => {
    if (autoCollapse) setRootCollapsed((value) => !value)
    else setManualRootCollapsed((value) => !value)
  }

  const groupLinked = (group) =>
    attributeRelations &&
    (group.attributes ?? []).some((attribute) =>
      linkedRefs?.has(attributeRef(qualifiedName, group.name, attribute.name)),
    )

  const isGroupCollapsed = (group) => {
    if (groupLinked(group)) return false
    const ref = groupRef(qualifiedName, group.name)
    return autoCollapse ? !expanded.has(ref) : manualCollapsed.has(ref)
  }

  const toggleGroup = (group) => {
    const ref = groupRef(qualifiedName, group.name)
    const update = (previous) => {
      const next = new Set(previous)
      if (next.has(ref)) next.delete(ref)
      else next.add(ref)
      return next
    }
    if (autoCollapse) setExpanded(update)
    else setManualCollapsed(update)
  }

  return { rootIsCollapsed, toggleRoot, isGroupCollapsed, toggleGroup }
}
