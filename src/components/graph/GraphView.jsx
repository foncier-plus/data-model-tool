import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { buildIndex } from '@/lib/model/refs'
import {
  buildAttributeEdges,
  buildObjectGraph,
  graphNeighbors,
  selectionObjectId,
} from '@/lib/model/graph'
import {
  buildVisibleGraph,
  filterObjectIds,
  namespacePrefixes,
} from '@/lib/model/hierarchy'
import { colorFor } from '@/lib/colors'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { EntityNode } from './EntityNode'
import { NamespaceNode } from './NamespaceNode'
import {
  COLLAPSED_GROUP_HEIGHT,
  COLLAPSED_GROUP_WIDTH,
  NODE_WIDTH,
  computeGroupRects,
  isUnderNamespace,
  objectSize,
} from '@/lib/layout'

const nodeTypes = { entity: EntityNode, namespace: NamespaceNode }

const GRID_COLUMNS = 6
const GRID_X = NODE_WIDTH + 80
const GRID_Y = 240

const GRAPH_BACKGROUND = {
  gap: 10,
  color: 'var(--graph-dot)',
  bgColor: 'var(--graph-background)',
}

function GraphCanvas({ entries, selection, onSelect, selectedObjects }) {
  const { fitView } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const linkAttributes = useProjectStore((state) => state.linkAttributes)

  const index = useMemo(() => buildIndex(entries), [entries])
  const fullObjectGraph = useMemo(() => buildObjectGraph(entries, index), [entries, index])
  const attributeGraph = useMemo(() => buildAttributeEdges(entries, index), [entries, index])

  const objectIds = useMemo(
    () => filterObjectIds(fullObjectGraph, selectedObjects),
    [fullObjectGraph, selectedObjects],
  )

  const [collapsed, setCollapsed] = useState(() => new Set())
  const visible = useMemo(
    () => buildVisibleGraph(fullObjectGraph, collapsed, objectIds),
    [fullObjectGraph, collapsed, objectIds],
  )

  const edgeMode = selection?.kind === 'attribute' ? 'attribute' : 'aggregated'

  const activeEdges = useMemo(() => {
    if (edgeMode === 'attribute') {
      return attributeGraph.edges.filter(
        (edge) =>
          visible.visibleObjectIds.has(edge.source) && visible.visibleObjectIds.has(edge.target),
      )
    }
    return visible.edges
  }, [edgeMode, attributeGraph, visible])

  const namespaceCounts = useMemo(() => {
    const map = new Map()
    for (const node of fullObjectGraph.nodes) {
      if (!node.namespace) continue
      for (const prefix of namespacePrefixes(node.namespace)) {
        map.set(prefix, (map.get(prefix) ?? 0) + 1)
      }
    }
    return map
  }, [fullObjectGraph])

  const namespaceOf = useMemo(
    () => new Map(fullObjectGraph.nodes.map((node) => [node.id, node.namespace ?? null])),
    [fullObjectGraph],
  )

  const selectedId = selectionObjectId(selection)
  const { upstream, downstream } = useMemo(
    () => graphNeighbors(fullObjectGraph, selectedId),
    [fullObjectGraph, selectedId],
  )

  const refNeighbors = useMemo(() => {
    const up = new Set()
    const down = new Set()
    if (edgeMode !== 'attribute' || !selection) return { up, down }
    for (const edge of attributeGraph.edges) {
      if (edge.targetRef === selection.ref) up.add(edge.sourceRef)
      if (edge.sourceRef === selection.ref) down.add(edge.targetRef)
    }
    return { up, down }
  }, [edgeMode, attributeGraph, selection])

  const revealRefs = useMemo(() => {
    const set = new Set()
    if (selection?.kind !== 'attribute') return set
    set.add(selection.ref)
    for (const edge of attributeGraph.edges) {
      if (edge.targetRef === selection.ref) set.add(edge.sourceRef)
      if (edge.sourceRef === selection.ref) set.add(edge.targetRef)
    }
    return set
  }, [selection, attributeGraph])

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

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const nodesRef = useRef([])
  const namespaceOfRef = useRef(namespaceOf)
  const positionsRef = useRef(new Map())
  const lastRectsRef = useRef(new Map())
  const gridRef = useRef(0)
  const dragStartRef = useRef(null)
  const appliedRef = useRef({ signature: null })
  const handlesRef = useRef(null)
  const pendingHandlesRef = useRef(false)
  const fittedTopology = useRef(null)
  const pendingFit = useRef(false)

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    namespaceOfRef.current = namespaceOf
  }, [namespaceOf])

  const measureKey = nodes
    .filter((node) => node.type === 'entity')
    .map(
      (node) =>
        `${node.id}:${Math.round(node.measured?.width ?? 0)}:${Math.round(node.measured?.height ?? 0)}`,
    )
    .join('|')

  const nextDefaultPosition = useCallback(() => {
    const slot = gridRef.current
    gridRef.current += 1
    return { x: (slot % GRID_COLUMNS) * GRID_X, y: Math.floor(slot / GRID_COLUMNS) * GRID_Y }
  }, [])

  const groupRects = useMemo(() => {
    const objects = nodes
      .filter((node) => node.type === 'entity')
      .map((node) => {
        const size = objectSize(node.data.model)
        return {
          id: node.id,
          namespace: node.data.namespace ?? null,
          x: node.position.x,
          y: node.position.y,
          width: node.measured?.width ?? size.width,
          height: node.measured?.height ?? size.height,
        }
      })
    return computeGroupRects(objects)
  }, [nodes])

  const toggleGroup = useCallback((namespace) => {
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(namespace)) next.delete(namespace)
      else next.add(namespace)
      return next
    })
  }, [])

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
        const unitNamespace = id.startsWith('ns:')
          ? id.slice(3)
          : namespaceOfRef.current.get(id)
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
    [setNodes],
  )

  useEffect(() => {
    const previousRects = lastRectsRef.current
    for (const object of visible.objectNodes) {
      if (!positionsRef.current.has(object.id)) {
        positionsRef.current.set(object.id, nextDefaultPosition())
      }
    }
    for (const namespace of visible.collapsedGroupIds) {
      const id = `ns:${namespace}`
      if (positionsRef.current.has(id)) continue
      const rect = previousRects.get(namespace)
      positionsRef.current.set(id, rect ? { x: rect.x, y: rect.y } : nextDefaultPosition())
    }

    const measuredMap = new Map(
      nodesRef.current.filter((node) => node.type === 'entity').map((node) => [node.id, node.measured]),
    )
    const revealKey = revealRefs.size ? [...revealRefs].sort().join(',') : ''
    const countsKey = [...namespaceCounts.entries()].sort().join(',')
    const objectKey = visible.objectNodes
      .map((object) => {
        const position = positionsRef.current.get(object.id)
        const dimensions = measuredMap.get(object.id)
        return `${object.id}:${position.x}:${position.y}:${dimensions?.width ?? 0}:${dimensions?.height ?? 0}`
      })
      .join('|')
    const groupKey = [...groupRects]
      .map(([fullName, rect]) => `${fullName}:${rect.x}:${rect.y}:${rect.width}:${rect.height}`)
      .join('|')
    const collapsedKey = [...visible.collapsedGroupIds]
      .map((namespace) => {
        const position = positionsRef.current.get(`ns:${namespace}`)
        return `${namespace}:${position.x}:${position.y}`
      })
      .join('|')
    const signature = `${edgeMode}~${revealKey}~${countsKey}~${objectKey}~${groupKey}~${collapsedKey}`

    if (appliedRef.current.signature !== signature) {
      appliedRef.current.signature = signature
      setNodes((previous) => {
        const byId = new Map(previous.map((node) => [node.id, node]))
        const specs = []

        for (const [fullName, rect] of groupRects) {
          const id = `ns:${fullName}`
          const existing = byId.get(id)
          specs.push({
            ...existing,
            id,
            type: 'namespace',
            position: { x: rect.x, y: rect.y },
            style: { width: rect.width, height: rect.height },
            zIndex: 0,
            data: {
              ...existing?.data,
              label: fullName,
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
            position: positionsRef.current.get(id),
            style: { width: COLLAPSED_GROUP_WIDTH, height: COLLAPSED_GROUP_HEIGHT },
            zIndex: 0,
            data: {
              ...existing?.data,
              label: namespace,
              collapsed: true,
              count: namespaceCounts.get(namespace) ?? 0,
              edgeMode,
              onToggle: toggleGroup,
            },
          })
        }

        for (const object of visible.objectNodes) {
          const existing = byId.get(object.id)
          specs.push({
            ...existing,
            id: object.id,
            type: 'entity',
            position: positionsRef.current.get(object.id),
            style: { width: NODE_WIDTH },
            zIndex: 1,
            measured: existing?.measured,
            data: {
              ...existing?.data,
              model: object.model,
              qualifiedName: object.id,
              namespace: object.namespace ?? null,
              index,
              color: colorFor(object.id),
              edgeMode,
              revealRefs,
            },
          })
        }

        return specs
      })
    }

    const topology = [
      ...visible.objectNodes.map((object) => object.id),
      ...[...groupRects.keys()].map((fullName) => `ns:${fullName}`),
      ...[...visible.collapsedGroupIds].map((namespace) => `ns:${namespace}`),
    ]
      .sort()
      .join(',')
    if (fittedTopology.current !== topology) {
      fittedTopology.current = topology
      pendingFit.current = true
    }

    const handlesKey = `${edgeMode}~${visible.objectNodes
      .map((object) => object.id)
      .sort()
      .join(',')}~${[...visible.collapsedGroupIds].sort().join(',')}`
    if (handlesRef.current !== handlesKey) {
      handlesRef.current = handlesKey
      pendingHandlesRef.current = true
    }

    const timer = window.setTimeout(() => {
      if (pendingHandlesRef.current) {
        pendingHandlesRef.current = false
        const handleNodeIds = [
          ...visible.objectNodes.map((object) => object.id),
          ...[...visible.collapsedGroupIds].map((namespace) => `ns:${namespace}`),
        ]
        updateNodeInternals(handleNodeIds)
      }
      if (pendingFit.current) {
        pendingFit.current = false
        fitView({ padding: 0.2, duration: 250 })
      }
    }, 60)
    lastRectsRef.current = groupRects
    return () => window.clearTimeout(timer)
  }, [
    visible,
    collapsed,
    edgeMode,
    index,
    namespaceCounts,
    revealRefs,
    groupRects,
    measureKey,
    nextDefaultPosition,
    toggleGroup,
    setNodes,
    fitView,
    updateNodeInternals,
  ])

  useEffect(() => {
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
  }, [activeEdges, edgeMode, setEdges])

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
        const isRelated =
          edgeMode === 'aggregated'
            ? !selectedId || edge.source === selectedId || edge.target === selectedId
            : !selection || edge.sourceRef === selection.ref || edge.targetRef === selection.ref
        const isUpstream =
          edgeMode === 'aggregated'
            ? edge.target === selectedId
            : edge.targetRef === selection?.ref
        const hasSelection = edgeMode === 'aggregated' ? Boolean(selectedId) : Boolean(selection)
        const emphasized = hasSelection && isRelated
        const hidden = hasSelection && !isRelated
        return {
          ...edge,
          animated: isUpstream,
          markerEnd: edge.markerEnd,
          labelStyle: { ...edge.labelStyle, opacity: hidden ? 0 : 1 },
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
    relatedObjects,
    refNeighbors,
    revealRefs,
    setNodes,
    setEdges,
  ])

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
        onNodesChange={handleNodesChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        elevateEdgesOnSelect={false}
        onPaneClick={() => onSelect(null)}
        onNodeClick={(_, node) => {
          if (node.type === 'namespace') return
          onSelect({
            kind: 'object',
            objectName: node.id,
            groupName: null,
            attributeName: null,
            ref: node.id,
          })
        }}
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
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

export function GraphView({ entries, selection, onSelect, selectedObjects }) {
  return (
    <ReactFlowProvider>
      <GraphCanvas
        entries={entries}
        selection={selection}
        onSelect={onSelect}
        selectedObjects={selectedObjects}
      />
    </ReactFlowProvider>
  )
}
