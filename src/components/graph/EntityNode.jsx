import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Equal,
  GripVertical,
  Pencil,
  Sigma,
} from 'lucide-react'
import { attributeRef, groupRef, originKind, resolveRef } from '@/lib/model/refs'
import { useTranslation } from '@/lib/i18n'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AboutLink } from '@/components/wiki/RichText'
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
  kind = 'none',
  warning,
  color,
  edgeMode,
  active,
  upstream,
  downstream,
  hasHighlight,
  dim,
  noTarget,
  noSource,
  onClick,
  description,
}) {
  const { t } = useTranslation()
  const stateClass = rowStateClass({ active, upstream, downstream, hasHighlight, dim })

  return (
    <div className="relative">
      {edgeMode === 'attribute' && !noTarget ? (
        <Handle
          type="target"
          position={Position.Left}
          id={rowRef}
          className="!size-1.5 !border-0"
          style={{ background: color }}
        />
      ) : null}

      <Tooltip>
        <TooltipTrigger asChild>
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
                kind === 'formula' ? 'bg-blue-400' : kind === 'linked' ? 'bg-emerald-400' : 'bg-zinc-200',
              )}
              title={
                kind === 'formula'
                  ? t('attribute.formula')
                  : kind === 'linked'
                    ? t('attribute.linked')
                    : t('attribute.simple')
              }
            >
              {kind === 'formula' ? (
                <Sigma className="size-2.5 text-white" />
              ) : kind === 'linked' ? (
                <Equal className="size-2.5 text-white" />
              ) : (
                <Pencil className="size-2.5 text-zinc-400" />
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
        </TooltipTrigger>
        {description ? (
          <TooltipContent side="right" className="max-w-72 whitespace-pre-wrap font-normal">
            {description}
          </TooltipContent>
        ) : null}
      </Tooltip>

      {edgeMode === 'attribute' && !noSource ? (
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
  const { t } = useTranslation()
  const select = useProjectStore((state) => state.select)
  const revealSelection = useProjectStore((state) => state.revealSelection)
  const openFile = useProjectStore((state) => state.openFile)
  const [expanded, setExpanded] = useState(() => new Set())
  const [manualCollapsed, setManualCollapsed] = useState(() => new Set())
  const [manualRootCollapsed, setManualRootCollapsed] = useState(false)
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
    linkedRefs,
    color,
    highlighted,
    dimmed,
    external = false,
    selectedRef,
    edgeMode,
    upstreamRefs,
    downstreamRefs,
    hasHighlight,
    autoCollapse = true,
    attributeRelations = false,
  } = data

  const objectSelected = highlighted || selectedRef === qualifiedName
  const isInput = model.type === 'input'
  const isOutput = model.type === 'output'
  const isTerminal = isInput || isOutput
  const rootAttributes = model.attributes ?? []
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
  const totalAttributes =
    rootAttributes.length +
    (model.groups ?? []).reduce((total, group) => total + (group.attributes?.length ?? 0), 0)

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

  const toggleGroup = (key) => {
    const update = (previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    }
    if (autoCollapse) setExpanded(update)
    else setManualCollapsed(update)
  }

  const rowProps = (ref, label, type, optional, example, kind, warning, onClick, description) => ({
    ref,
    label,
    type,
    optional,
    example,
    kind,
    warning,
    color,
    edgeMode,
    active: selectedRef === ref,
    upstream: upstreamRefs?.has(ref) ?? false,
    downstream: downstreamRefs?.has(ref) ?? false,
    hasHighlight,
    dim: dimmed,
    noTarget: isInput,
    noSource: isOutput,
    onClick,
    description,
  })

  const showRootGroup = data.rootGroup ?? false
  const activate = data.revealOnClick ? revealSelection : select

  const renderRootRow = (attribute) => {
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
          originKind(attribute.origin),
          isUnresolved(attribute.origin, index, namespace),
          () =>
            activate({
              kind: 'attribute',
              objectName: qualifiedName,
              groupName: null,
              attributeName: attribute.name,
              ref,
            }),
          attribute.description,
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex w-full flex-col overflow-hidden rounded-lg border-2 bg-card text-foreground transition-opacity',
        isTerminal && 'border-4 border-double',
        dimmed && !objectSelected && 'opacity-30',
      )}
      style={{
        borderColor: data.conflict
          ? '#dc2626'
          : isTerminal
            ? '#3f3f46'
            : objectSelected
              ? color
              : withAlpha(color, 0.55),
        opacity: dimmed && !objectSelected ? 0.3 : external && !objectSelected ? 0.7 : undefined,
      }}
    >
      {edgeMode === 'aggregated' && !isInput ? (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-2 !border-0"
          style={{ top: 16, background: color }}
        />
      ) : null}

      <div
        className={cn(
          'flex h-8 w-full items-center gap-2 px-2 text-xs font-semibold',
          isTerminal && 'text-white',
        )}
        style={{
          background: isTerminal ? '#3f3f46' : withAlpha(color, objectSelected ? 0.42 : 0.15),
          borderBottom: `1px solid ${isTerminal ? '#27272a' : withAlpha(color, 0.4)}`,
        }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left hover:brightness-95"
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
          <span className="truncate">{model.name}</span>
        </button>
        {model.about ? (
          <AboutLink
            about={model.about}
            yamlFileName={data.fileName}
            className={isTerminal ? 'text-white hover:bg-white/20' : undefined}
          />
        ) : null}
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
          style={{ background: color }}
        >
          {totalAttributes}
        </span>
      </div>

      {model.description ? (
        <div className="px-2 pt-1 text-[10px] leading-4 break-words text-muted-foreground [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-[10px] [&_em]:italic [&_h1]:mt-1 [&_h1]:text-xs [&_h2]:mt-1 [&_h2]:text-xs [&_h3]:mt-1 [&_h3]:text-[10px] [&_h4]:mt-0.5 [&_h4]:text-[10px] [&_li]:my-0 [&_ol]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-0.5 [&_pre]:my-1 [&_pre]:overflow-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-1 [&_strong]:font-semibold [&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{model.description}</ReactMarkdown>
        </div>
      ) : null}

      {data.conflict && data.files?.length > 0 ? (
        <div className="flex flex-col gap-0.5 border-b border-red-300 bg-red-50 px-2 py-1 text-[10px] text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          <span className="flex items-center gap-1 font-semibold">
            <AlertTriangle className="size-3" />
            {t('entity.conflict')}
          </span>
          {data.files.map((file) => (
            <button
              key={file}
              type="button"
              title={t('entity.openFile', { file })}
              className="truncate text-left underline underline-offset-2"
              onClick={(event) => {
                event.stopPropagation()
                openFile(file)
              }}
            >
              {file}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-1 p-1.5">
        {rootAttributes.length > 0 ? (
          showRootGroup ? (
            <div
              className="overflow-hidden rounded border border-dashed"
              style={{ borderColor: withAlpha(color, 0.4) }}
            >
              <div className="flex h-6 items-center gap-1 px-1 text-[10px] text-muted-foreground">
                <Chevron
                  collapsed={rootIsCollapsed}
                  onClick={() =>
                    autoCollapse
                      ? setRootCollapsed((value) => !value)
                      : setManualRootCollapsed((value) => !value)
                  }
                  label="root attributes"
                />
                <span className="flex-1" />
                <span className="pr-1">{rootAttributes.length}</span>
              </div>
              {rootIsCollapsed ? null : (
                <div className="flex flex-col gap-0.5 p-1">{rootAttributes.map(renderRootRow)}</div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">{rootAttributes.map(renderRootRow)}</div>
          )
        ) : null}

        {(model.groups ?? []).map((group) => {
          const ref = groupRef(qualifiedName, group.name)
          const groupActive = selectedRef === ref
          const groupUpstream = upstreamRefs?.has(ref) ?? false
          const groupDownstream = downstreamRefs?.has(ref) ?? false
          const groupLinked =
            attributeRelations &&
            (group.attributes ?? []).some((attribute) =>
              linkedRefs?.has(attributeRef(qualifiedName, group.name, attribute.name)),
            )
          const isCollapsed = groupLinked
            ? false
            : autoCollapse
              ? !expanded.has(ref)
              : manualCollapsed.has(ref)
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="flex h-6 min-w-0 flex-1 items-center gap-1.5 pr-1 text-left text-[11px] font-medium hover:brightness-95"
                      onClick={(event) => {
                        event.stopPropagation()
                        activate({
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
                  </TooltipTrigger>
                  {group.description ? (
                    <TooltipContent
                      side="right"
                      className="max-w-72 whitespace-pre-wrap font-normal"
                    >
                      {group.description}
                    </TooltipContent>
                  ) : null}
                </Tooltip>
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
                          originKind(attribute.origin),
                          isUnresolved(attribute.origin, index, namespace),
                          () =>
                            activate({
                              kind: 'attribute',
                              objectName: qualifiedName,
                              groupName: group.name,
                              attributeName: attribute.name,
                              ref: attributeRefValue,
                            }),
                          attribute.description,
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

      {edgeMode === 'aggregated' && !isOutput ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-2 !border-0"
          style={{ top: 16, background: color }}
        />
      ) : null}

      {edgeMode === 'attribute' ? (
        <Handle
          type="source"
          position={Position.Right}
          id={qualifiedName}
          isConnectable={false}
          className="!size-1.5 !border-0"
          style={{ top: 16, background: color }}
        />
      ) : null}
    </div>
  )
}
