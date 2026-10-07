import { Handle, Position } from '@xyflow/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertTriangle, GripVertical } from 'lucide-react'
import { attributeRef, originKind } from '@/lib/model/refs'
import { useTranslation } from '@/lib/i18n'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { AboutLink } from '@/components/wiki/AboutLink'
import { withAlpha } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { Chevron, EntityRow } from './EntityRow'
import { EntityGroup } from './EntityGroup'
import { isUnresolved } from './entityNodeUtils'
import { useEntityCollapse } from './useEntityCollapse'

export function EntityNode({ data }) {
  const { t } = useTranslation()
  const select = useProjectStore((state) => state.select)
  const revealSelection = useProjectStore((state) => state.revealSelection)
  const openFile = useProjectStore((state) => state.openFile)

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

  const rootAttributes = model.attributes ?? []
  const groups = model.groups ?? []
  const objectSelected = highlighted || selectedRef === qualifiedName
  const isInput = model.type === 'input'
  const isOutput = model.type === 'output'
  const isTerminal = isInput || isOutput
  const totalAttributes =
    rootAttributes.length +
    groups.reduce((total, group) => total + (group.attributes?.length ?? 0), 0)
  const showRootGroup = data.rootGroup ?? false
  const activate = data.revealOnClick ? revealSelection : select

  const { rootIsCollapsed, toggleRoot, isGroupCollapsed, toggleGroup } = useEntityCollapse({
    model,
    qualifiedName,
    rootAttributes,
    revealRefs,
    linkedRefs,
    highlighted,
    autoCollapse,
    attributeRelations,
  })

  const renderRow = (attribute, groupName) => {
    const ref = attributeRef(qualifiedName, groupName, attribute.name)
    return (
      <EntityRow
        key={ref}
        rowRef={ref}
        label={attribute.name}
        type={attribute.type}
        optional={attribute.optional}
        example={attribute.example}
        kind={originKind(attribute.origin)}
        warning={isUnresolved(attribute.origin, index, namespace)}
        color={color}
        edgeMode={edgeMode}
        active={selectedRef === ref}
        upstream={upstreamRefs?.has(ref) ?? false}
        downstream={downstreamRefs?.has(ref) ?? false}
        hasHighlight={hasHighlight}
        dim={dimmed}
        noTarget={isInput}
        noSource={isOutput}
        onClick={() =>
          activate({
            kind: 'attribute',
            objectName: qualifiedName,
            groupName,
            attributeName: attribute.name,
            ref,
          })
        }
        description={attribute.description}
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
                  onClick={toggleRoot}
                  label="root attributes"
                />
                <span className="flex-1" />
                <span className="pr-1">{rootAttributes.length}</span>
              </div>
              {rootIsCollapsed ? null : (
                <div className="flex flex-col gap-0.5 p-1">
                  {rootAttributes.map((attribute) => renderRow(attribute, null))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {rootAttributes.map((attribute) => renderRow(attribute, null))}
            </div>
          )
        ) : null}

        {groups.map((group) => (
          <EntityGroup
            key={group.name}
            data={data}
            group={group}
            collapsed={isGroupCollapsed(group)}
            onToggle={() => toggleGroup(group)}
            activate={activate}
            renderRow={renderRow}
          />
        ))}
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
