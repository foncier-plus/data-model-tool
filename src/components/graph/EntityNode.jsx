import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Sigma,
} from 'lucide-react'
import { attributeRef, groupRef, resolveRef } from '@/lib/model/refs'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { typeStyle, withAlpha } from '@/lib/colors'
import { cn } from '@/lib/utils'

function isUnresolved(origin, index, namespace) {
  return Boolean(origin?.from?.some((ref) => !resolveRef(ref, index, namespace)))
}

function rowStateClass({ active, upstream, downstream, hasHighlight, dim }) {
  if (active) return 'bg-primary/20 ring-1 ring-primary'
  if (upstream) return 'bg-sky-500/15 ring-1 ring-sky-400'
  if (downstream) return 'bg-emerald-500/15 ring-1 ring-emerald-400'
  if (hasHighlight || dim) return 'opacity-40'
  return ''
}

function groupBackground(color, { active, upstream, downstream }) {
  if (active) return withAlpha(color, 0.34)
  if (upstream) return 'rgba(14, 165, 233, 0.15)'
  if (downstream) return 'rgba(16, 185, 129, 0.15)'
  return withAlpha(color, 0.08)
}

function Chevron({ collapsed, onClick, label }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={!collapsed}
      className="flex size-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
    </button>
  )
}

function Row({
  ref: rowRef,
  label,
  type,
  optional,
  example,
  derived,
  warning,
  color,
  edgeMode,
  active,
  upstream,
  downstream,
  hasHighlight,
  dim,
  onClick,
}) {
  const stateClass = rowStateClass({ active, upstream, downstream, hasHighlight, dim })

  return (
    <div className="relative">
      {edgeMode === 'attribute' ? (
        <Handle
          type="target"
          position={Position.Left}
          id={rowRef}
          className="!size-1.5 !border-0"
          style={{ background: color }}
        />
      ) : null}

      <button
        type="button"
        className={cn(
          'grid w-full grid-cols-[16px_minmax(0,1fr)_auto_auto] items-center gap-2 rounded px-1.5 py-0.5 text-left text-[11px] hover:bg-accent',
          stateClass,
        )}
        onClick={(event) => {
          event.stopPropagation()
          onClick()
        }}
      >
        <span
          className={cn(
            'flex size-4 items-center justify-center rounded-sm',
            derived ? 'bg-blue-400' : 'bg-zinc-200',
          )}
          title={derived ? 'Computed attribute' : 'Plain attribute'}
        >
          {derived ? (
            <Sigma className="size-2.5 text-white" />
          ) : (
            <Pencil className={cn('size-2.5', 'text-zinc-400')} />
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span
            className={cn(
              'truncate font-mono',
              optional ? 'font-normal italic' : 'font-bold',
              warning && 'text-destructive',
            )}
          >
            {label}
          </span>
          {example ? (
            <span className="truncate text-[10px] italic text-muted-foreground">{example}</span>
          ) : null}
        </span>
        {warning ? <AlertTriangle className="size-3 text-destructive" /> : <span />}
        {type ? (
          <span className={cn('rounded px-1 font-mono text-[10px]', typeStyle(type))}>{type}</span>
        ) : (
          <span />
        )}
      </button>

      {edgeMode === 'attribute' ? (
        <Handle
          type="source"
          position={Position.Right}
          id={rowRef}
          className="!size-1.5 !border-0"
          style={{ background: color }}
        />
      ) : null}
    </div>
  )
}

export function EntityNode({ data }) {
  const select = useProjectStore((state) => state.select)
  const [expanded, setExpanded] = useState(() => new Set())
  const [rootCollapsed, setRootCollapsed] = useState(true)
  const [lastReveal, setLastReveal] = useState('')
  const [autoGroups, setAutoGroups] = useState(() => new Set())
  const [autoRoot, setAutoRoot] = useState(false)
  const {
    model,
    qualifiedName,
    namespace,
    index,
    revealRefs,
    color,
    highlighted,
    dimmed,
    selectedRef,
    edgeMode,
    upstreamRefs,
    downstreamRefs,
    hasHighlight,
  } = data

  const objectSelected = highlighted || selectedRef === qualifiedName
  const rootAttributes = model.attributes ?? []
  const totalAttributes =
    rootAttributes.length +
    (model.groups ?? []).reduce((total, group) => total + (group.attributes?.length ?? 0), 0)

  const revealKey = revealRefs?.size ? [...revealRefs].sort().join('|') : ''
  if (revealKey !== lastReveal) {
    setLastReveal(revealKey)
    if (!highlighted) {
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
        const related = nextAuto.size > 0 || revealRoot

        if (related) {
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

  const toggleGroup = (key) =>
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const rowProps = (ref, label, type, optional, example, derived, warning, onClick) => ({
    ref,
    label,
    type,
    optional,
    example,
    derived,
    warning,
    color,
    edgeMode,
    active: selectedRef === ref,
    upstream: upstreamRefs?.has(ref) ?? false,
    downstream: downstreamRefs?.has(ref) ?? false,
    hasHighlight,
    dim: dimmed,
    onClick,
  })

  return (
    <div
      className={cn(
        'flex w-full flex-col overflow-hidden rounded-lg border-2 bg-card text-foreground transition-opacity',
        dimmed && !objectSelected && 'opacity-30',
      )}
      style={{ borderColor: objectSelected ? color : withAlpha(color, 0.55) }}
    >
      {edgeMode === 'aggregated' ? (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-2 !border-0"
          style={{ top: 16, background: color }}
        />
      ) : null}

      <button
        type="button"
        className="flex h-8 w-full items-center gap-2 px-2 text-left text-xs font-semibold hover:brightness-95"
        style={{
          background: withAlpha(color, objectSelected ? 0.42 : 0.15),
          borderBottom: `1px solid ${withAlpha(color, 0.4)}`,
        }}
        onClick={(event) => {
          event.stopPropagation()
          select({
            kind: 'object',
            objectName: qualifiedName,
            groupName: null,
            attributeName: null,
            ref: qualifiedName,
          })
        }}
      >
        <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
        {namespace ? (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
            style={{ background: withAlpha(color, 0.35) }}
          >
            {namespace}
          </span>
        ) : null}
        <span className="truncate">{model.name}</span>
        <span className="flex-1" />
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
          style={{ background: color }}
        >
          {totalAttributes}
        </span>
      </button>

      {model.description ? (
        <div className="px-2 pt-1 text-[10px] leading-4 break-words text-muted-foreground">
          {model.description}
        </div>
      ) : null}

      <div className="flex flex-col gap-1 p-1.5">
        {rootAttributes.length > 0 ? (
          <div
            className="overflow-hidden rounded border border-dashed"
            style={{ borderColor: withAlpha(color, 0.4) }}
          >
            <div className="flex h-6 items-center gap-1 px-1 text-[10px] text-muted-foreground">
              <Chevron
                collapsed={rootCollapsed}
                onClick={() => setRootCollapsed((value) => !value)}
                label="root attributes"
              />
              <span className="flex-1" />
              <span className="pr-1">{rootAttributes.length}</span>
            </div>
            {rootCollapsed ? null : (
              <div className="flex flex-col gap-0.5 p-1">
                {rootAttributes.map((attribute) => {
                  const ref = attributeRef(qualifiedName, null, attribute.name)
                  return (
                    <Row
                      key={ref}
                      {...rowProps(
                        ref,
                        attribute.name,
                        attribute.type,
                        attribute.optional,
                        attribute.example,
                        Boolean(attribute.origin),
                        isUnresolved(attribute.origin, index, namespace),
                        () =>
                          select({
                            kind: 'attribute',
                            objectName: qualifiedName,
                            groupName: null,
                            attributeName: attribute.name,
                            ref,
                          }),
                      )}
                    />
                  )
                })}
              </div>
            )}
          </div>
        ) : null}

        {(model.groups ?? []).map((group) => {
          const ref = groupRef(qualifiedName, group.name)
          const groupActive = selectedRef === ref
          const groupUpstream = upstreamRefs?.has(ref) ?? false
          const groupDownstream = downstreamRefs?.has(ref) ?? false
          const isCollapsed = !expanded.has(ref)
          return (
            <div
              key={ref}
              className="overflow-hidden rounded border"
              style={{ borderColor: withAlpha(color, 0.35) }}
            >
              <div
                className={cn(
                  'flex items-center gap-1 px-1',
                  groupUpstream && 'ring-1 ring-sky-400',
                  groupDownstream && 'ring-1 ring-emerald-400',
                  (hasHighlight || dimmed) && !groupActive && 'opacity-40',
                )}
                style={{
                  background: groupBackground(color, {
                    active: groupActive,
                    upstream: groupUpstream,
                    downstream: groupDownstream,
                  }),
                }}
              >
                <Chevron
                  collapsed={isCollapsed}
                  onClick={() => toggleGroup(ref)}
                  label={group.name}
                />
                <button
                  type="button"
                  className="flex h-6 min-w-0 flex-1 items-center gap-1.5 pr-1 text-left text-[11px] font-medium hover:brightness-95"
                  onClick={(event) => {
                    event.stopPropagation()
                    select({
                      kind: 'group',
                      objectName: qualifiedName,
                      groupName: group.name,
                      attributeName: null,
                      ref,
                    })
                  }}
                >
                  <span className="truncate">{group.name}</span>
                  <span className="flex-1" />
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {group.attributes?.length ?? 0}
                  </span>
                  {isUnresolved(group.origin, index, namespace) ? (
                    <AlertTriangle className="size-3 shrink-0 text-destructive" />
                  ) : null}
                </button>
              </div>

              {isCollapsed ? null : (
                <div className="flex flex-col gap-0.5 p-1">
                  {(group.attributes ?? []).map((attribute) => {
                    const attributeRefValue = attributeRef(
                      qualifiedName,
                      group.name,
                      attribute.name,
                    )
                    return (
                      <Row
                        key={attributeRefValue}
                        {...rowProps(
                          attributeRefValue,
                          attribute.name,
                          attribute.type,
                          attribute.optional,
                          attribute.example,
                          Boolean(attribute.origin),
                          isUnresolved(attribute.origin, index, namespace),
                          () =>
                            select({
                              kind: 'attribute',
                              objectName: qualifiedName,
                              groupName: group.name,
                              attributeName: attribute.name,
                              ref: attributeRefValue,
                            }),
                        )}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {edgeMode === 'aggregated' ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-2 !border-0"
          style={{ top: 16, background: color }}
        />
      ) : null}
    </div>
  )
}
