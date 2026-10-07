import { useCallback, useRef } from 'react'
import { isUnderNamespace } from '@/lib/layout'

// Node dragging (moving a namespace moves its contained units) and group
// collapse toggling.
export function useGraphInteractions({ onNodesChange, setNodes, setCollapsed, namespaceOfRef }) {
  const positionsRef = useRef(new Map())
  const dragStartRef = useRef(null)

  const toggleGroup = useCallback(
    (namespace) => {
      setCollapsed((previous) => {
        const next = new Set(previous)
        if (next.has(namespace)) next.delete(namespace)
        else next.add(namespace)
        return next
      })
    },
    [setCollapsed],
  )

  const handleNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes)
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          positionsRef.current.set(change.id, { x: change.position.x, y: change.position.y })
        }
      }
    },
    [onNodesChange],
  )

  const handleNodeDragStart = useCallback((_, node) => {
    dragStartRef.current = {
      id: node.id,
      position: { x: node.position.x, y: node.position.y },
      namespace: node.type === 'namespace' ? node.id.slice(3) : null,
    }
  }, [])

  const handleNodeDrag = useCallback(
    (_, node) => {
      const start = dragStartRef.current
      if (!start || start.id !== node.id) return
      if (node.type !== 'namespace' || !start.namespace) return
      const delta = {
        x: node.position.x - start.position.x,
        y: node.position.y - start.position.y,
      }
      dragStartRef.current = { ...start, position: { x: node.position.x, y: node.position.y } }
      if (delta.x === 0 && delta.y === 0) return

      const namespace = start.namespace
      for (const [id, position] of [...positionsRef.current]) {
        if (id === node.id) continue
        const unitNamespace = id.startsWith('ns:') ? id.slice(3) : namespaceOfRef.current.get(id)
        if (unitNamespace && isUnderNamespace(unitNamespace, namespace)) {
          positionsRef.current.set(id, { x: position.x + delta.x, y: position.y + delta.y })
        }
      }

      setNodes((previous) =>
        previous.map((item) => {
          if (item.id === node.id) return item
          const position = positionsRef.current.get(item.id)
          if (!position) return item
          if (item.position.x === position.x && item.position.y === position.y) return item
          return { ...item, position }
        }),
      )
    },
    [setNodes, namespaceOfRef],
  )

  return {
    positionsRef,
    handleNodesChange,
    handleNodeDragStart,
    handleNodeDrag,
    toggleGroup,
  }
}
