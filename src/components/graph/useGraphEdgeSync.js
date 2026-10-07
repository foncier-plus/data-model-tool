import { useEffect } from 'react'
import { MarkerType } from '@xyflow/react'
import { colorFor } from '@/lib/colors'

// Keeps React Flow edges (and per-node/edge selection styling) in sync with the
// active graph and current selection.
export function useGraphEdgeSync({
  activeEdges,
  edgeMode,
  setEdges,
  selectionKey,
  selectedId,
  selection,
  selectedGroupRefs,
  relatedObjects,
  refNeighbors,
  revealRefs,
  setNodes,
}) {
  useEffect(() => {
    setEdges((previous) => {
      const byId = new Map(previous.map((edge) => [edge.id, edge]))
      return activeEdges.map((edge) => {
        const color = colorFor(edge.source)
        const existing = byId.get(edge.id)
        return {
          ...existing,
          id: edge.id,
          type: 'flat',
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          sourceRef: edge.sourceRef,
          targetRef: edge.targetRef,
          zIndex: edgeMode === 'attribute' ? 2 : 0,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            markerUnits: 'userSpaceOnUse',
            width: 25,
            height: 25,
          },
          style: { stroke: color, strokeWidth: 1.5, cursor: 'pointer' },
        }
      })
    })
  }, [activeEdges, edgeMode, setEdges])

  useEffect(() => {
    // Only a focused attribute (or group) dims the other attributes and
    // highlights its connections. Selecting an object must not gray out rows.
    const hasHighlight =
      edgeMode === 'attribute' && Boolean(selection) && selection.kind !== 'object'

    setNodes((previous) =>
      previous.map((node) => ({
        ...node,
        data: {
          ...node.data,
          edgeMode,
          revealRefs,
          highlighted: node.id === selectedId,
          dimmed: Boolean(selectedId) && !relatedObjects.has(node.id),
          selectedRef: selection?.ref ?? null,
          hasHighlight,
          upstreamRefs: refNeighbors.up,
          downstreamRefs: refNeighbors.down,
        },
      })),
    )

    setEdges((previous) =>
      previous.map((edge) => {
        const hasSelection = edgeMode === 'aggregated' ? Boolean(selectedId) : Boolean(selection)
        const isRelated = (() => {
          if (edgeMode === 'aggregated') {
            return !selectedId || edge.source === selectedId || edge.target === selectedId
          }
          if (!selection) return true
          if (selection.kind === 'attribute') {
            return edge.sourceRef === selection.ref || edge.targetRef === selection.ref
          }
          if (selection.kind === 'group') {
            return (
              selectedGroupRefs?.has(edge.sourceRef) === true ||
              selectedGroupRefs?.has(edge.targetRef) === true
            )
          }
          return edge.source === selectedId || edge.target === selectedId
        })()
        const isUpstream =
          edgeMode === 'aggregated'
            ? edge.target === selectedId
            : edge.targetRef === selection?.ref
        const emphasized = hasSelection && isRelated
        const hidden = hasSelection && !isRelated
        return {
          ...edge,
          animated: isUpstream,
          markerEnd: edge.markerEnd,
          style: {
            ...edge.style,
            opacity: hidden ? 0 : 1,
            strokeWidth: emphasized ? 3 : 1.5,
          },
        }
      }),
    )
  }, [
    selectionKey,
    edgeMode,
    selectedId,
    selection,
    selectedGroupRefs,
    relatedObjects,
    refNeighbors,
    revealRefs,
    setNodes,
    setEdges,
  ])
}
