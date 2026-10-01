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
import { attributeRef, buildIndex, resolveRef, validateReferences } from '@/lib/model/refs'
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
import { useLocalStorageState } from '@/lib/useLocalStorageState'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { DependencyNode } from './DependencyNode'
import { EntityNode } from './EntityNode'
import { FlatEdge } from './FlatEdge'
import { GraphSettings } from './GraphSettings'
import { NamespaceNode } from './NamespaceNode'
import {
  COLLAPSED_GROUP_HEIGHT,
  COLLAPSED_GROUP_WIDTH,
  COLUMN_GAP,
  NAMESPACE_PADDING,
  NS_HEADER_HEIGHT,
  NODE_WIDTH,
  isUnderNamespace,
  layoutGraph,
  objectSize,
} from '@/lib/layout'

const nodeTypes = { entity: EntityNode, namespace: NamespaceNode, dependency: DependencyNode }
const edgeTypes = { flat: FlatEdge }

const DEPENDENCY_WIDTH = 180
const DEPENDENCY_HEIGHT = 36

const GRAPH_BACKGROUND = {
  gap: 10,
  color: 'var(--graph-dot)',
  bgColor: 'var(--graph-background)',
}

// Files living in a root-level directory whose name starts with "_" are
// hidden from the data model (e.g. "_draft", "_archive").
function isHiddenRootFile(fileName) {
  const slash = fileName.indexOf('/')
  if (slash === -1) return false
  return fileName.slice(0, slash).startsWith('_')
}

function GraphCanvas({ entries, selection, onSelect, selectedObjects, scope = 'all', fileName = null }) {
  const { fitView } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const linkAttributes = useProjectStore((state) => state.linkAttributes)

  const graphEntries = useMemo(
    () =>
      scope === 'file' ? entries : entries.filter((entry) => !isHiddenRootFile(entry.fileName)),
    [entries, scope],
  )
  const index = useMemo(() => buildIndex(graphEntries), [graphEntries])
  const fullObjectGraph = useMemo(() => buildObjectGraph(graphEntries, index), [graphEntries, index])
  const attributeGraph = useMemo(
    () => buildAttributeEdges(graphEntries, index),
    [graphEntries, index],
  )

  const internalIds = useMemo(() => {
    if (scope !== 'file' || !fileName) return null
    return new Set(
      graphEntries.filter((entry) => entry.fileName === fileName).map((entry) => entry.qualifiedName),
    )
  }, [scope, fileName, graphEntries])

  const objectIds = useMemo(
    () => filterObjectIds(fullObjectGraph, internalIds ?? selectedObjects),
    [fullObjectGraph, selectedObjects, internalIds],
  )

  const [collapsed, setCollapsed] = useState(() => new Set())
  const [graphSettings, setGraphSettings] = useLocalStorageState('data-flow.graph-settings', {
    rootGroup: false,
    autoCollapse: true,
    attributeRelations: false,
    showParentObjects: false,
  })
  const { rootGroup, autoCollapse, attributeRelations, showParentObjects } = graphSettings
  const updateSettings = (patch) => setGraphSettings((previous) => ({ ...previous, ...patch }))
  const visible = useMemo(
    () => buildVisibleGraph(fullObjectGraph, collapsed, objectIds),
    [fullObjectGraph, collapsed, objectIds],
  )

  const contentKey = useMemo(
    () => visible.objectNodes.map((object) => `${object.id}:${JSON.stringify(object.model)}`).join('|'),
    [visible],
  )

  const edgeMode =
    attributeRelations || selection?.kind === 'attribute' ? 'attribute' : 'aggregated'

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

  // When attribute relations are shown, every attribute involved in a link
  // is revealed so the containing groups expand automatically.
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

  // File scope: only issues of the edited YAML file. Data model: every issue.
  // Grouped by owning object.
  const issueGroups = useMemo(() => {
    const all = validateReferences(graphEntries)
    const filtered =
      scope === 'file' && fileName ? all.filter((issue) => issue.file === fileName) : all
    const groups = new Map()
    for (const issue of filtered) {
      const element = resolveRef(issue.ref, index)
      const objectName = element?.objectName ?? issue.ref
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
  }, [graphEntries, scope, fileName, index])
  const revealSelection = useProjectStore((state) => state.revealSelection)
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
  const positionsRef = useRef(new Map())
  const dragStartRef = useRef(null)
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
    const signature = `${edgeMode}~${scope}~${autoCollapse}~${rootGroup}~${attributeRelations}~${showParentObjects}~${revealKey}~${countsKey}~${objectKey}~${groupKey}~${collapsedKey}~${contentKey}`

    if (appliedRef.current.signature !== signature) {
      appliedRef.current.signature = signature
      setNodes((previous) => {
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
              label: fullName,
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
            position: positionsRef.current.get(id),
            style: {
              width: COLLAPSED_GROUP_WIDTH,
              height: COLLAPSED_GROUP_HEIGHT,
              pointerEvents: 'none',
            },
            zIndex: 0,
            data: {
              ...existing?.data,
              label: namespace,
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
          const condensed = Boolean(
            internalIds && !internalIds.has(object.id) && !showParentObjects,
          )

          if (condensed) {
            specs.push({
              ...existing,
              id: object.id,
              type: 'dependency',
              selectable: true,
              position: positionsRef.current.get(object.id),
              style: { width: DEPENDENCY_WIDTH },
              zIndex: 1,
              measured: existing?.measured,
              data: {
                ...existing?.data,
                label: object.model?.name ?? object.id,
                namespace: object.namespace ?? null,
                color: colorFor(object.id),
                highlighted: object.id === selectedId,
                dimmed: Boolean(selectedId) && !relatedObjects.has(object.id),
              },
            })
            continue
          }

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
              fileName: object.fileName ?? null,
              conflict: object.conflict ?? false,
              files: object.files ?? null,
              revealOnClick: scope === 'file',
              index,
              color: colorFor(object.id),
              edgeMode,
              revealRefs,
              linkedRefs,
              autoCollapse,
              attributeRelations,
              rootGroup,
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
  ])

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

export function GraphView({ entries, selection, onSelect, selectedObjects, scope, fileName }) {
  return (
    <ReactFlowProvider>
      <GraphCanvas
        entries={entries}
        selection={selection}
        onSelect={onSelect}
        selectedObjects={selectedObjects}
        scope={scope}
        fileName={fileName}
      />
    </ReactFlowProvider>
  )
}
