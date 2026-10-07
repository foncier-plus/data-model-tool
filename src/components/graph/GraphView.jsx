import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { attributeRef, buildIndex, resolveRef, validateReferences } from '@/lib/model/refs'
import {
  buildAttributeEdges,
  buildObjectGraph,
  graphNeighbors,
  selectionObjectId,
} from '@/lib/model/graph'
import { buildVisibleGraph, filterObjectIds, namespacePrefixes } from '@/lib/model/hierarchy'
import { useLocalStorageState } from '@/lib/useLocalStorageState'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { GraphSettings } from './GraphSettings'
import {
  COLLAPSED_GROUP_HEIGHT,
  COLLAPSED_GROUP_WIDTH,
  COLUMN_GAP,
  NAMESPACE_PADDING,
  NS_HEADER_HEIGHT,
  layoutGraph,
  objectSize,
} from '@/lib/layout'
import {
  DEPENDENCY_HEIGHT,
  DEPENDENCY_WIDTH,
  GRAPH_BACKGROUND,
  edgeTypes,
  isHiddenRootFile,
  nodeTypes,
} from './graphConstants'
import { buildNodeSpecs } from './buildNodeSpecs'
import { useGraphInteractions } from './useGraphInteractions'
import { useGraphEdgeSync } from './useGraphEdgeSync'

function GraphCanvas({
  entries,
  selection,
  onSelect,
  scope = 'file',
  fileName = null,
  internalObjectIds = null,
}) {
  const { fitView } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const linkAttributes = useProjectStore((state) => state.linkAttributes)
  const revealSelection = useProjectStore((state) => state.revealSelection)

  const graphEntries = useMemo(
    () => (scope === 'file' ? entries : entries.filter((entry) => !isHiddenRootFile(entry.fileName))),
    [entries, scope],
  )
  const index = useMemo(() => buildIndex(graphEntries), [graphEntries])
  const fullObjectGraph = useMemo(() => buildObjectGraph(graphEntries, index), [graphEntries, index])
  const attributeGraph = useMemo(() => buildAttributeEdges(graphEntries, index), [graphEntries, index])

  const internalIds = useMemo(() => {
    if (internalObjectIds) return internalObjectIds
    if (scope !== 'file' || !fileName) return null
    return new Set(
      graphEntries.filter((entry) => entry.fileName === fileName).map((entry) => entry.qualifiedName),
    )
  }, [scope, fileName, graphEntries, internalObjectIds])

  const [collapsed, setCollapsed] = useState(() => new Set())
  const [graphSettings, setGraphSettings] = useLocalStorageState('data-flow.graph-settings', {
    rootGroup: false,
    autoCollapse: true,
    attributeRelations: false,
    showParentObjects: false,
    showChildObjects: false,
  })
  const {
    rootGroup,
    autoCollapse,
    attributeRelations,
    showParentObjects,
    showChildObjects = false,
  } = graphSettings
  const updateSettings = (patch) => setGraphSettings((previous) => ({ ...previous, ...patch }))

  const objectIds = useMemo(
    () => filterObjectIds(fullObjectGraph, internalIds, { children: showChildObjects }),
    [fullObjectGraph, internalIds, showChildObjects],
  )

  const visible = useMemo(
    () => buildVisibleGraph(fullObjectGraph, collapsed, objectIds),
    [fullObjectGraph, collapsed, objectIds],
  )

  const contentKey = useMemo(
    () => visible.objectNodes.map((object) => `${object.id}:${JSON.stringify(object.model)}`).join('|'),
    [visible],
  )

  const edgeMode = attributeRelations || selection?.kind === 'attribute' ? 'attribute' : 'aggregated'

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
    if (edgeMode !== 'attribute' || selection?.kind !== 'attribute') return { up, down }
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

  // When attribute relations are shown, every attribute involved in a link is
  // revealed so the containing groups expand automatically.
  const linkedRefs = useMemo(() => {
    const set = new Set()
    if (!attributeRelations) return set
    for (const edge of attributeGraph.edges) {
      if (!visible.visibleObjectIds.has(edge.source) || !visible.visibleObjectIds.has(edge.target)) {
        continue
      }
      set.add(edge.sourceRef)
      set.add(edge.targetRef)
    }
    return set
  }, [attributeRelations, attributeGraph, visible])

  // Only report issues of the objects actually shown in the current graph.
  const issueGroups = useMemo(() => {
    const all = validateReferences(graphEntries)
    const groups = new Map()
    for (const issue of all) {
      const element = resolveRef(issue.ref, index)
      const objectName = element?.objectName ?? issue.ref
      if (objectIds && !objectIds.has(objectName)) continue
      if (!groups.has(objectName)) {
        groups.set(objectName, {
          objectName,
          label: element?.model?.name ?? objectName,
          issues: [],
        })
      }
      groups.get(objectName).issues.push(issue)
    }
    return [...groups.values()]
  }, [graphEntries, index, objectIds])

  const handleSelectIssue = (issue) => {
    const element = resolveRef(issue.ref, index)
    if (!element) return
    revealSelection({
      kind: element.kind,
      objectName: element.objectName,
      groupName: element.groupName ?? null,
      attributeName: element.attributeName ?? null,
      ref: element.ref,
    })
  }

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

  const selectedGroupRefs = useMemo(() => {
    if (selection?.kind !== 'group') return null
    const entry = graphEntries.find((item) => item.qualifiedName === selection.objectName)
    const group = entry?.model?.groups?.find((item) => item.name === selection.groupName)
    if (!group) return null
    return new Set(
      (group.attributes ?? []).map((attribute) =>
        attributeRef(selection.objectName, group.name, attribute.name),
      ),
    )
  }, [selection, graphEntries])

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const nodesRef = useRef([])
  const namespaceOfRef = useRef(namespaceOf)
  const appliedRef = useRef({ signature: null })
  const appliedLayoutRef = useRef(null)
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

  const { positionsRef, handleNodesChange, handleNodeDragStart, handleNodeDrag, toggleGroup } =
    useGraphInteractions({
      onNodesChange,
      setNodes,
      setCollapsed,
      namespaceOfRef,
    })

  useGraphEdgeSync({
    activeEdges,
    edgeMode,
    setEdges,
    selectionKey: [
      edgeMode,
      selectedId ?? '',
      selection?.ref ?? '',
      [...upstream].sort().join(','),
      [...downstream].sort().join(','),
      [...refNeighbors.up].sort().join(','),
      [...refNeighbors.down].sort().join(','),
    ].join('|'),
    selectedId,
    selection,
    selectedGroupRefs,
    relatedObjects,
    refNeighbors,
    revealRefs,
    setNodes,
  })

  const measureKey = nodes
    .filter((node) => node.type === 'entity')
    .map(
      (node) =>
        `${node.id}:${Math.round(node.measured?.width ?? 0)}:${Math.round(node.measured?.height ?? 0)}`,
    )
    .join('|')

  const nextDefaultPosition = useCallback(() => ({ x: 0, y: 0 }), [])

  const units = useMemo(
    () => [
      ...visible.objectNodes.map((node) => ({
        id: node.id,
        namespace: node.namespace ?? null,
        kind: 'object',
      })),
      ...[...visible.collapsedGroupIds].map((namespace) => ({
        id: `ns:${namespace}`,
        namespace,
        kind: 'collapsed',
      })),
    ],
    [visible],
  )

  const sizes = useMemo(() => {
    const map = new Map()
    for (const node of nodes) {
      if (node.type === 'entity') {
        const size = objectSize(node.data.model)
        map.set(node.id, {
          width: node.measured?.width ?? size.width,
          height: node.measured?.height ?? size.height,
        })
      } else if (node.type === 'dependency') {
        map.set(node.id, { width: DEPENDENCY_WIDTH, height: DEPENDENCY_HEIGHT })
      }
    }
    return map
  }, [nodes])

  const [layoutGroups, setLayoutGroups] = useState(() => new Map())
  const [layoutPositions, setLayoutPositions] = useState(() => new Map())

  const groupRects = useMemo(() => {
    const result = new Map()
    for (const [name, rect] of layoutGroups) result.set(name, { ...rect })

    const stats = new Map()
    const accumulate = (namespace, dx, dy, x, y, width, height) => {
      if (!namespace) return
      for (const prefix of namespacePrefixes(namespace)) {
        const entry =
          stats.get(prefix) ?? {
            dx: 0,
            dy: 0,
            count: 0,
            minX: Infinity,
            minY: Infinity,
            maxX: -Infinity,
            maxY: -Infinity,
          }
        entry.dx += dx
        entry.dy += dy
        entry.count += 1
        entry.minX = Math.min(entry.minX, x)
        entry.minY = Math.min(entry.minY, y)
        entry.maxX = Math.max(entry.maxX, x + width)
        entry.maxY = Math.max(entry.maxY, y + height)
        stats.set(prefix, entry)
      }
    }

    for (const node of nodes) {
      if (node.type !== 'entity' && node.type !== 'dependency') continue
      const layout = layoutPositions.get(node.id)
      if (!layout) continue
      const size =
        node.type === 'entity'
          ? objectSize(node.data.model)
          : { width: DEPENDENCY_WIDTH, height: DEPENDENCY_HEIGHT }
      accumulate(
        node.data.namespace ?? null,
        node.position.x - layout.x,
        node.position.y - layout.y,
        node.position.x,
        node.position.y,
        node.measured?.width ?? size.width,
        node.measured?.height ?? size.height,
      )
    }

    for (const node of nodes) {
      if (node.type === 'namespace' && node.data.collapsed && node.data.namespace) {
        accumulate(
          node.data.namespace,
          0,
          0,
          node.position.x,
          node.position.y,
          COLLAPSED_GROUP_WIDTH,
          COLLAPSED_GROUP_HEIGHT,
        )
      }
    }

    for (const [name, rect] of layoutGroups) {
      const entry = stats.get(name)
      if (!entry || entry.count === 0) continue
      const x = rect.x + entry.dx / entry.count
      const y = rect.y + entry.dy / entry.count
      const minX = Math.min(x, entry.minX - NAMESPACE_PADDING)
      const minY = Math.min(y, entry.minY - NAMESPACE_PADDING - NS_HEADER_HEIGHT)
      const maxX = Math.max(x + rect.width, entry.maxX + NAMESPACE_PADDING)
      const maxY = Math.max(y + rect.height, entry.maxY + NAMESPACE_PADDING)
      result.set(name, { fullName: name, x: minX, y: minY, width: maxX - minX, height: maxY - minY })
    }

    return result
  }, [nodes, layoutGroups, layoutPositions])

  useEffect(() => {
    const layoutKey = [
      units.map((unit) => unit.id).sort().join(','),
      [...collapsed].sort().join(','),
      [...sizes]
        .map(([id, size]) => `${id}:${Math.round(size.width)}x${Math.round(size.height)}`)
        .sort()
        .join(','),
      visible.edges
        .map((edge) => `${edge.source}->${edge.target}`)
        .sort()
        .join(','),
    ].join('~')

    if (appliedLayoutRef.current !== layoutKey) {
      appliedLayoutRef.current = layoutKey
      const layout = layoutGraph({
        units,
        edges: visible.edges,
        collapsed,
        sizes,
        columnGap: COLUMN_GAP,
      })
      const nextPositions = new Map()
      for (const [id, position] of layout.positions) {
        positionsRef.current.set(id, position)
        nextPositions.set(id, position)
      }
      setLayoutPositions(nextPositions)
      setLayoutGroups(layout.groups)
    }
    for (const unit of units) {
      if (!positionsRef.current.has(unit.id)) {
        positionsRef.current.set(unit.id, nextDefaultPosition())
      }
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
    const signature = `${edgeMode}~${scope}~${autoCollapse}~${rootGroup}~${attributeRelations}~${showParentObjects}~${showChildObjects}~${revealKey}~${countsKey}~${objectKey}~${groupKey}~${collapsedKey}~${contentKey}`

    if (appliedRef.current.signature !== signature) {
      appliedRef.current.signature = signature
      setNodes((previous) =>
        buildNodeSpecs({
          previous,
          visible,
          groupRects,
          namespaceCounts,
          positions: positionsRef.current,
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
        }),
      )
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
    return () => window.clearTimeout(timer)
  }, [
    visible,
    collapsed,
    edgeMode,
    index,
    namespaceCounts,
    revealRefs,
    linkedRefs,
    groupRects,
    internalIds,
    selectedId,
    relatedObjects,
    contentKey,
    autoCollapse,
    attributeRelations,
    showParentObjects,
    showChildObjects,
    rootGroup,
    scope,
    units,
    sizes,
    measureKey,
    nextDefaultPosition,
    toggleGroup,
    setNodes,
    fitView,
    updateNodeInternals,
    positionsRef,
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
      <GraphSettings
        settings={graphSettings}
        onChange={updateSettings}
        issueGroups={issueGroups}
        onSelectIssue={handleSelectIssue}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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

export function GraphView({ entries, selection, onSelect, scope, fileName, internalObjectIds }) {
  return (
    <ReactFlowProvider>
      <GraphCanvas
        entries={entries}
        selection={selection}
        onSelect={onSelect}
        scope={scope}
        fileName={fileName}
        internalObjectIds={internalObjectIds}
      />
    </ReactFlowProvider>
  )
}
