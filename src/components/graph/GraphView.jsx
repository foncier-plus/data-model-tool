import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  ControlButton,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react'
import { Settings } from 'lucide-react'
import '@xyflow/react/dist/style.css'
import { buildIndex } from '@/lib/model/refs'
import {
  buildAttributeEdges,
  buildObjectGraph,
  graphNeighbors,
  selectionObjectId,
} from '@/lib/model/graph'
import { colorFor } from '@/lib/colors'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { EntityNode } from './EntityNode'
import { LayoutSettings } from './LayoutSettings'
import {
  NODE_WIDTH,
  forceLayout,
  objectSize,
  separateOverlaps,
} from './layout'

const nodeTypes = { entity: EntityNode }

const REPULSION_DEFAULT = 20
const LINK_DEFAULT = 40

const GRAPH_BACKGROUND = {
  gap: 10,
  color: 'var(--graph-dot)',
  bgColor: 'var(--graph-background)',
}

function GraphCanvas({ entries, selection, onSelect, namespace }) {
  const { fitView } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const linkAttributes = useProjectStore((state) => state.linkAttributes)
  const edgeMode = selection?.kind === 'attribute' ? 'attribute' : 'aggregated'

  const index = useMemo(() => buildIndex(entries), [entries])
  const fullObjectGraph = useMemo(() => buildObjectGraph(entries, index), [entries, index])
  const attributeGraph = useMemo(() => buildAttributeEdges(entries, index), [entries, index])

  const objectGraph = useMemo(() => {
    if (!namespace) return fullObjectGraph
    const nodes = fullObjectGraph.nodes.filter((node) => node.namespace === namespace)
    const visible = new Set(nodes.map((node) => node.id))
    return {
      nodes,
      edges: fullObjectGraph.edges.filter(
        (edge) => visible.has(edge.source) && visible.has(edge.target),
      ),
    }
  }, [fullObjectGraph, namespace])

  const attributeEdges = useMemo(() => {
    if (!namespace) return attributeGraph.edges
    const visible = new Set(objectGraph.nodes.map((node) => node.id))
    return attributeGraph.edges.filter(
      (edge) => visible.has(edge.source) && visible.has(edge.target),
    )
  }, [attributeGraph, objectGraph, namespace])

  const selectedId = selectionObjectId(selection)
  const { upstream, downstream } = useMemo(
    () => graphNeighbors(objectGraph, selectedId),
    [objectGraph, selectedId],
  )

  const refNeighbors = useMemo(() => {
    const up = new Set()
    const down = new Set()
    if (edgeMode !== 'attribute' || !selection) return { up, down }
    for (const edge of attributeEdges) {
      if (edge.targetRef === selection.ref) up.add(edge.sourceRef)
      if (edge.sourceRef === selection.ref) down.add(edge.targetRef)
    }
    return { up, down }
  }, [edgeMode, attributeEdges, selection])

  const revealRefs = useMemo(() => {
    const set = new Set()
    if (selection?.kind !== 'attribute') return set
    set.add(selection.ref)
    for (const edge of attributeEdges) {
      if (edge.targetRef === selection.ref) set.add(edge.sourceRef)
      if (edge.sourceRef === selection.ref) set.add(edge.targetRef)
    }
    return set
  }, [selection, attributeEdges])

  const relatedObjects = useMemo(() => {
    const set = new Set()
    if (!selectedId) return set
    set.add(selectedId)
    for (const id of upstream) set.add(id)
    for (const id of downstream) set.add(id)
    if (edgeMode === 'attribute') {
      for (const ref of [...refNeighbors.up, ...refNeighbors.down]) {
        const element = index.get(ref)?.[0]
        if (element) set.add(element.objectName)
      }
    }
    return set
  }, [selectedId, upstream, downstream, edgeMode, refNeighbors, index])

  const activeEdges = edgeMode === 'aggregated' ? objectGraph.edges : attributeEdges

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [repulsionDistance, setRepulsionDistance] = useState(REPULSION_DEFAULT)
  const [linkDistance, setLinkDistance] = useState(LINK_DEFAULT)
  const [layoutVersion, setLayoutVersion] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const positions = useRef(new Map())
  const layoutApplied = useRef(null)
  const fittedTopology = useRef(null)
  const nodesRef = useRef([])
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  const measureKey = nodes
    .map((node) => `${node.id}:${Math.round(node.measured?.width ?? 0)}:${Math.round(node.measured?.height ?? 0)}`)
    .join('|')

  useEffect(() => {
    const known = new Set(fullObjectGraph.nodes.map((node) => node.id))
    for (const id of [...positions.current.keys()]) {
      if (!known.has(id)) positions.current.delete(id)
    }

    const appliedKey = `${repulsionDistance}|${linkDistance}|${layoutVersion}`
    const canLayout = nodesRef.current.length > 0
    const relayout = canLayout && layoutApplied.current !== appliedKey
    if (relayout) {
      layoutApplied.current = appliedKey
      const measured = new Map(nodesRef.current.map((node) => [node.id, node.measured]))
      positions.current = forceLayout({
        nodes: fullObjectGraph.nodes.map((node) => {
          const size = objectSize(node.model)
          const dimensions = measured.get(node.id)
          return {
            id: node.id,
            width: dimensions?.width ?? size.width,
            height: dimensions?.height ?? size.height,
          }
        }),
        edges: fullObjectGraph.edges,
        options: { repulsionDistance, linkDistance },
        initial: positions.current,
      })
    }

    for (const node of fullObjectGraph.nodes) {
      if (!positions.current.has(node.id)) positions.current.set(node.id, { x: 0, y: 0 })
    }

    setNodes((previous) => {
      const byId = new Map(previous.map((node) => [node.id, node]))
      return objectGraph.nodes.map((node) => {
        const existing = byId.get(node.id)
        return {
          ...existing,
          id: node.id,
          type: 'entity',
          position: positions.current.get(node.id) ?? { x: 0, y: 0 },
          style: { ...(existing?.style ?? {}), width: NODE_WIDTH },
          zIndex: 1,
          draggable: true,
          data: {
            ...(existing?.data ?? {}),
            model: node.model,
            qualifiedName: node.id,
            namespace: node.namespace ?? null,
            index,
            revealRefs,
            color: colorFor(node.id),
            edgeMode,
          },
        }
      })
    })

    setEdges(
      activeEdges.map((edge) => {
        const color = colorFor(edge.source)
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          sourceRef: edge.sourceRef,
          targetRef: edge.targetRef,
          zIndex: edgeMode === 'attribute' ? 2 : 0,
          label: edge.count > 1 ? String(edge.count) : undefined,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            markerUnits: 'userSpaceOnUse',
            width: 25,
            height: 25,
          },
          labelStyle: { fontSize: 10, fill: color },
          style: { stroke: color, strokeWidth: 1.5, cursor: 'pointer' },
        }
      }),
    )

    if (objectGraph.nodes.length === 0) return
    const topology = objectGraph.nodes.map((node) => node.id).sort().join(',')
    const shouldFit = fittedTopology.current !== topology || relayout
    if (shouldFit) fittedTopology.current = topology
    const timer = window.setTimeout(() => {
      updateNodeInternals(objectGraph.nodes.map((node) => node.id))
      if (shouldFit) fitView({ padding: 0.2, duration: 250 })
    }, 60)
    return () => window.clearTimeout(timer)
  }, [
    objectGraph,
    activeEdges,
    edgeMode,
    index,
    revealRefs,
    fullObjectGraph,
    repulsionDistance,
    linkDistance,
    layoutVersion,
    measureKey,
    setNodes,
    setEdges,
    fitView,
    updateNodeInternals,
  ])

  const selectionKey = useMemo(
    () =>
      [
        edgeMode,
        selectedId ?? '',
        selection?.ref ?? '',
        [...upstream].sort().join(','),
        [...downstream].sort().join(','),
        [...refNeighbors.up].sort().join(','),
        [...refNeighbors.down].sort().join(','),
      ].join('|'),
    [edgeMode, selectedId, selection, upstream, downstream, refNeighbors],
  )

  useEffect(() => {
    const hasHighlight = edgeMode === 'attribute' && Boolean(selection)

    setNodes((previous) =>
      previous.map((node) => ({
        ...node,
        data: {
          ...node.data,
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
        const isRelated =
          edgeMode === 'aggregated'
            ? !selectedId || edge.source === selectedId || edge.target === selectedId
            : !selection ||
              edge.sourceRef === selection.ref ||
              edge.targetRef === selection.ref
        const isUpstream =
          edgeMode === 'aggregated'
            ? edge.target === selectedId
            : edge.targetRef === selection?.ref
        const hasSelection = edgeMode === 'aggregated' ? Boolean(selectedId) : Boolean(selection)
        const emphasized = hasSelection && isRelated
        return {
          ...edge,
          animated: isUpstream,
          markerEnd: edge.markerEnd,
          style: {
            ...edge.style,
            opacity: hasSelection && !isRelated ? 0 : 1,
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
    relatedObjects,
    refNeighbors,
    setNodes,
    setEdges,
  ])

  const handleDrag = useCallback(
    (_, dragged) => {
      positions.current.set(dragged.id, dragged.position)
      const fixed = new Set([dragged.id])
      setNodes((previous) => {
        const layoutNodes = previous.map((node) => ({
          id: node.id,
          width: node.measured?.width ?? NODE_WIDTH,
          height: node.measured?.height ?? objectSize(node.data.model).height,
        }))
        const current = new Map(
          previous.map((node) => [
            node.id,
            node.id === dragged.id ? { ...dragged.position } : { ...node.position },
          ]),
        )
        const next = separateOverlaps({
          nodes: layoutNodes,
          positions: current,
          fixed,
          padding: repulsionDistance,
        })
        return previous.map((node) => {
          if (node.id === dragged.id) return node
          const position = next.get(node.id)
          if (!position) return node
          if (position.x === node.position.x && position.y === node.position.y) return node
          positions.current.set(node.id, position)
          return { ...node, position }
        })
      })
    },
    [setNodes, repulsionDistance],
  )

  const handleDragStop = useCallback((_, node) => {
    positions.current.set(node.id, node.position)
  }, [])

  const handleRelayout = useCallback(() => {
    setLayoutVersion((value) => value + 1)
  }, [])

  const handleConnect = useCallback(
    (connection) => {
      if (!connection.sourceHandle || !connection.targetHandle) return
      linkAttributes(connection.sourceHandle, connection.targetHandle)
    },
    [linkAttributes],
  )

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDrag={handleDrag}
        onNodeDragStop={handleDragStop}
        onConnect={handleConnect}
        elevateEdgesOnSelect={false}
        onPaneClick={() => onSelect(null)}
        onNodeClick={(_, node) =>
          onSelect({
            kind: 'object',
            objectName: node.id,
            groupName: null,
            attributeName: null,
            ref: node.id,
          })
        }
        onEdgeClick={(_, edge) =>
          onSelect({
            kind: 'object',
            objectName: edge.source,
            groupName: null,
            attributeName: null,
            ref: edge.source,
          })
        }
        minZoom={0.15}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background {...GRAPH_BACKGROUND} />
        <Controls showInteractive={false}>
          <ControlButton
            onClick={() => setSettingsOpen((open) => !open)}
            title="Paramètres de positionnement"
            aria-label="Paramètres de positionnement"
          >
            <Settings size={14} style={{ fill: 'none' }} />
          </ControlButton>
        </Controls>
      </ReactFlow>
      {settingsOpen && (
        <LayoutSettings
          linkDistance={linkDistance}
          repulsion={repulsionDistance}
          onLinkDistance={setLinkDistance}
          onRepulsion={setRepulsionDistance}
          onRelayout={handleRelayout}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

export function GraphView({ entries, selection, onSelect, namespace }) {
  return (
    <ReactFlowProvider>
      <GraphCanvas
        entries={entries}
        selection={selection}
        onSelect={onSelect}
        namespace={namespace}
      />
    </ReactFlowProvider>
  )
}
