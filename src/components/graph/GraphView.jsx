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
import {
  buildVisibleGraph,
  filterObjectIds,
  namespacePrefixes,
  nearestExpandedNamespace,
} from '@/lib/model/hierarchy'
import { colorFor } from '@/lib/colors'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { EntityNode } from './EntityNode'
import { LayoutSettings } from './LayoutSettings'
import { NamespaceNode } from './NamespaceNode'
import {
  COLLAPSED_GROUP_HEIGHT,
  COLLAPSED_GROUP_WIDTH,
  NODE_WIDTH,
  finishLayout,
  hierarchyLayout,
  objectSize,
} from '@/lib/layout'

const nodeTypes = { entity: EntityNode, namespace: NamespaceNode }

const COLLISION_GAP_DEFAULT = 16
const STABILITY_DEFAULT = 0.25
const EDGE_STRENGTH_DEFAULT = 0.06

function buildInitialPositions(nodes, groupGlobals, fallback) {
  const positions = new Map()
  for (const node of nodes) {
    if (node.type === 'namespace' && !node.data?.collapsed) continue
    const parent = node.parentId ? groupGlobals.get(node.parentId.slice(3)) : null
    const base = parent ?? { x: 0, y: 0 }
    positions.set(node.id, { x: base.x + node.position.x, y: base.y + node.position.y })
  }
  return positions.size > 0 ? positions : fallback
}

function buildUnits(visible, measured) {
  return [
    ...visible.objectNodes.map((node) => {
      const size = objectSize(node.model)
      const dimensions = measured.get(node.id)
      return {
        id: node.id,
        namespace: node.namespace ?? null,
        kind: 'object',
        width: dimensions?.width ?? size.width,
        height: dimensions?.height ?? size.height,
      }
    }),
    ...[...visible.collapsedGroupIds].map((namespace) => ({
      id: `ns:${namespace}`,
      namespace,
      kind: 'collapsed',
      width: COLLAPSED_GROUP_WIDTH,
      height: COLLAPSED_GROUP_HEIGHT,
    })),
  ]
}

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
  const [collisionGap, setCollisionGap] = useState(COLLISION_GAP_DEFAULT)
  const [stability, setStability] = useState(STABILITY_DEFAULT)
  const [edgeStrength, setEdgeStrength] = useState(EDGE_STRENGTH_DEFAULT)
  const [layoutVersion, setLayoutVersion] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)

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

  const revealObjectIds = useMemo(() => {
    const set = new Set()
    for (const ref of revealRefs) {
      const element = index.get(ref)?.[0]
      if (element) set.add(element.objectName)
    }
    return set
  }, [revealRefs, index])

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
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  const measureKey = nodes
    .filter((node) => node.type === 'entity')
    .map((node) => `${node.id}:${Math.round(node.measured?.width ?? 0)}:${Math.round(node.measured?.height ?? 0)}`)
    .join('|')

  const positionsRef = useRef(new Map())
  const groupsGlobalRef = useRef(new Map())
  const appliedRef = useRef({ unitsKey: '', settingsKey: '', done: false })
  const draggingRef = useRef(new Set())
  const visibleRef = useRef(visible)
  const collapsedRef = useRef(collapsed)
  const paramsRef = useRef({ collisionGap, stability, edgeStrength })
  useEffect(() => {
    visibleRef.current = visible
    collapsedRef.current = collapsed
    paramsRef.current = { collisionGap, stability, edgeStrength }
  })
  const fittedTopology = useRef(null)
  const pendingFit = useRef(false)

  const handleNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes)
      for (const change of changes) {
        if (change.type !== 'position') continue
        if (change.dragging) draggingRef.current.add(change.id)
        else draggingRef.current.delete(change.id)
      }
    },
    [onNodesChange],
  )

  const toggleGroup = useCallback((namespace) => {
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(namespace)) next.delete(namespace)
      else next.add(namespace)
      return next
    })
  }, [])

  useEffect(() => {
    const measured = new Map(
      nodesRef.current
        .filter((node) => node.type === 'entity')
        .map((node) => [node.id, node.measured]),
    )
    const units = buildUnits(visible, measured)

    const unitsKey = units.map((unit) => `${unit.id}:${unit.kind}`).sort().join('|')
    const settingsKey = `${collisionGap}|${stability}|${edgeStrength}|${layoutVersion}`
    const unitsChanged = appliedRef.current.unitsKey !== unitsKey
    const settingsChanged = appliedRef.current.settingsKey !== settingsKey

    const sizes = new Map()
    for (const node of nodesRef.current) {
      if (node.type !== 'entity') continue
      sizes.set(
        node.id,
        `${Math.round(node.measured?.width ?? 0)}x${Math.round(node.measured?.height ?? 0)}`,
      )
    }
    const previousSizes = appliedRef.current.sizes ?? new Map()
    const changedIds = []
    for (const [id, signature] of sizes) {
      if (previousSizes.get(id) !== signature) changedIds.push(id)
    }
    for (const id of previousSizes.keys()) {
      if (!sizes.has(id)) changedIds.push(id)
    }
    const sizeChanged = changedIds.length > 0
    const selectionDriven =
      sizeChanged && changedIds.every((id) => revealObjectIds.has(id))
    const measuredReady = [...sizes.values()].some((signature) => signature !== '0x0')

    const versionChanged =
      !appliedRef.current.done || appliedRef.current.version !== layoutVersion
    const unanchored = versionChanged || unitsChanged || !appliedRef.current.measured
    const relayout =
      !appliedRef.current.done ||
      unitsChanged ||
      settingsChanged ||
      versionChanged ||
      (sizeChanged && !selectionDriven)

    if (unanchored) positionsRef.current = new Map()

    const initial = unanchored
      ? new Map()
      : buildInitialPositions(nodesRef.current, groupsGlobalRef.current, positionsRef.current)

    appliedRef.current = {
      unitsKey,
      settingsKey,
      measureKey,
      version: layoutVersion,
      measured: appliedRef.current.measured || measuredReady,
      sizes,
      done: true,
    }

    let layout
    if (relayout) {
      layout = hierarchyLayout({
        units,
        edges: visible.edges,
        collapsed,
        options: { collisionGap, stability, edgeStrength },
        initial,
      })
      positionsRef.current = layout.positions
    } else {
      layout = finishLayout({ units, positions: initial, collapsed })
    }

    groupsGlobalRef.current = new Map(
      layout.groups.map((group) => [group.fullName, { x: group.x, y: group.y }]),
    )

    const specs = []
    for (const group of layout.groups) {
      specs.push({
        id: group.id,
        type: 'namespace',
        parentId: group.parent ? `ns:${group.parent}` : undefined,
        extent: group.parent ? 'parent' : undefined,
        position: layout.groupRelative.get(group.id),
        style: { width: group.width, height: group.height },
        zIndex: 0,
        data: {
          label: group.label,
          collapsed: false,
          count: namespaceCounts.get(group.fullName) ?? 0,
          edgeMode,
          onToggle: toggleGroup,
        },
      })
    }
    for (const namespace of visible.collapsedGroupIds) {
      const container = nearestExpandedNamespace(namespace, collapsed)
      specs.push({
        id: `ns:${namespace}`,
        type: 'namespace',
        parentId: container ? `ns:${container}` : undefined,
        extent: container ? 'parent' : undefined,
        position: layout.unitRelative.get(`ns:${namespace}`),
        style: { width: COLLAPSED_GROUP_WIDTH, height: COLLAPSED_GROUP_HEIGHT },
        zIndex: 0,
        data: {
          label: namespace,
          collapsed: true,
          count: namespaceCounts.get(namespace) ?? 0,
          edgeMode,
          onToggle: toggleGroup,
        },
      })
    }
    for (const node of visible.objectNodes) {
      const container = nearestExpandedNamespace(node.namespace ?? null, collapsed)
      specs.push({
        id: node.id,
        type: 'entity',
        parentId: container ? `ns:${container}` : undefined,
        extent: container ? 'parent' : undefined,
        position: layout.unitRelative.get(node.id),
        style: { width: NODE_WIDTH },
        zIndex: 1,
        data: {
          model: node.model,
          qualifiedName: node.id,
          namespace: node.namespace ?? null,
          index,
          color: colorFor(node.id),
          edgeMode,
          revealRefs,
        },
      })
    }

    setNodes((previous) => {
      const byId = new Map(previous.map((node) => [node.id, node]))
      return specs.map((spec) => {
        const existing = byId.get(spec.id)
        const position = existing && !relayout ? existing.position : spec.position
        return { ...existing, ...spec, position, measured: existing?.measured }
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

    const topology = specs.map((spec) => spec.id).sort().join(',')
    if (fittedTopology.current !== topology) {
      fittedTopology.current = topology
      pendingFit.current = true
    }
    const timer = window.setTimeout(() => {
      const handleNodeIds = [
        ...visible.objectNodes.map((node) => node.id),
        ...[...visible.collapsedGroupIds].map((namespace) => `ns:${namespace}`),
      ]
      updateNodeInternals(handleNodeIds)
      if (pendingFit.current) {
        pendingFit.current = false
        fitView({ padding: 0.2, duration: 250 })
      }
    }, 60)
    return () => window.clearTimeout(timer)
  }, [
    visible,
    collapsed,
    edgeMode,
    activeEdges,
    index,
    namespaceCounts,
    revealRefs,
    revealObjectIds,
    collisionGap,
    stability,
    edgeStrength,
    layoutVersion,
    measureKey,
    toggleGroup,
    setNodes,
    setEdges,
    fitView,
    updateNodeInternals,
  ])

  useEffect(() => {
    let frame = 0
    let last = 0
    const raf = window.requestAnimationFrame
      ? window.requestAnimationFrame.bind(window)
      : (callback) => window.setTimeout(() => callback(performance.now()), 16)
    const caf = window.cancelAnimationFrame
      ? window.cancelAnimationFrame.bind(window)
      : window.clearTimeout

    const step = (time) => {
      frame = raf(step)
      if (time - last < 80) return
      last = time

      const currentVisible = visibleRef.current
      const currentCollapsed = collapsedRef.current
      const current = nodesRef.current
      const unitCount = currentVisible.objectNodes.length + currentVisible.collapsedGroupIds.size
      if (unitCount === 0) return

      const measured = new Map(
        current.filter((node) => node.type === 'entity').map((node) => [node.id, node.measured]),
      )
      const units = buildUnits(currentVisible, measured)
      const initial = buildInitialPositions(current, groupsGlobalRef.current, positionsRef.current)
      const layout = hierarchyLayout({
        units,
        edges: currentVisible.edges,
        collapsed: currentCollapsed,
        options: paramsRef.current,
        initial,
      })

      groupsGlobalRef.current = new Map(
        layout.groups.map((group) => [group.fullName, { x: group.x, y: group.y }]),
      )
      positionsRef.current = layout.positions
      const groupById = new Map(layout.groups.map((group) => [group.id, group]))

      setNodes((previous) => {
        let changed = false
        const next = previous.map((node) => {
          if (draggingRef.current.has(node.id)) return node
          if (node.type === 'entity') {
            const position = layout.unitRelative.get(node.id)
            if (!position) return node
            if (node.position.x === position.x && node.position.y === position.y) return node
            changed = true
            return { ...node, position }
          }
          if (node.type === 'namespace') {
            const group = groupById.get(node.id)
            if (group) {
              const position = layout.groupRelative.get(node.id)
              const width = group.width
              const height = group.height
              if (
                node.position.x === position.x &&
                node.position.y === position.y &&
                node.style?.width === width &&
                node.style?.height === height
              ) {
                return node
              }
              changed = true
              return { ...node, position, style: { width, height } }
            }
            const position = layout.unitRelative.get(node.id)
            if (!position) return node
            if (node.position.x === position.x && node.position.y === position.y) return node
            changed = true
            return { ...node, position }
          }
          return node
        })
        return changed ? next : previous
      })
    }

    frame = raf(step)
    return () => caf(frame)
  }, [setNodes])

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
        onNodesChange={handleNodesChange}
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
          collisionGap={collisionGap}
          stability={stability}
          edgeStrength={edgeStrength}
          onCollisionGap={setCollisionGap}
          onStability={setStability}
          onEdgeStrength={setEdgeStrength}
          onRelayout={handleRelayout}
          onClose={() => setSettingsOpen(false)}
        />
      )}
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
