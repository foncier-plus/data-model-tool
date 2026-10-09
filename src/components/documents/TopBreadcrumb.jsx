import { Fragment } from 'react'
import { Box, ChevronRight, FileCode, Hash } from 'lucide-react'
import { classifyFile, splitFileName } from '@/lib/fs/documentType'
import { fileVisual } from '@/components/files/visuals'
import { attributeRef, groupRef } from '@/lib/model/refs'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { cn } from '@/lib/utils'

function selectionItems(selection, objectLabel) {
  if (!selection) return []
  const { objectName, groupName, attributeName } = selection
  const items = [
    {
      key: 'object',
      Icon: Box,
      label: objectLabel,
      selection: { kind: 'object', objectName, groupName: null, attributeName: null, ref: objectName },
    },
  ]
  if (groupName) {
    items.push({
      key: 'group',
      Icon: null,
      label: groupName,
      selection: {
        kind: 'group',
        objectName,
        groupName,
        attributeName: null,
        ref: groupRef(objectName, groupName),
      },
    })
  }
  if (attributeName) {
    items.push({
      key: 'attribute',
      Icon: null,
      label: attributeName,
      selection: {
        kind: 'attribute',
        objectName,
        groupName,
        attributeName,
        ref: attributeRef(objectName, groupName, attributeName),
      },
    })
  }
  return items
}

function docItems(docTarget) {
  return [
    { key: 'doc', Icon: FileCode, label: docTarget.label },
    ...(docTarget.headings ?? []).map((heading, index) => ({
      key: `heading-${index}`,
      Icon: Hash,
      label: heading.label,
    })),
  ]
}

// Top-bar breadcrumb: the main document (solid background) followed by the
// focused element or documentation target (lighter background).
export function TopBreadcrumb({ fileName, focus, onSelectFile }) {
  const select = useProjectStore((state) => state.select)
  const entries = useProjectStore((state) => state.entries)
  const file = fileName.split('/').pop()
  const { Icon: FileIcon, text } = fileVisual(classifyFile(file))
  const { base } = splitFileName(file)

  const selection = focus?.type === 'element' ? focus.selection : null
  const entry = selection
    ? entries.find((item) => (item.qualifiedName ?? item.model?.name) === selection.objectName)
    : null
  const objectLabel = entry?.model?.name ?? selection?.objectName
  const items =
    focus?.type === 'document'
      ? docItems(focus.target)
      : selectionItems(selection, objectLabel)
  const interactive = focus?.type !== 'document'

  return (
    <div className="flex min-w-0 items-center gap-1">
      <button
        type="button"
        onClick={() => onSelectFile?.()}
        className="flex min-w-0 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-slate-900 shadow-sm hover:bg-white"
      >
        <FileIcon className={cn('size-4 shrink-0', text)} />
        <span className="max-w-64 truncate text-sm font-medium">{base}</span>
      </button>

      {items.map((item, index) => {
        const last = index === items.length - 1
        const chip = (
          <>
            {item.Icon ? <item.Icon className="size-3.5 shrink-0" /> : null}
            <span className="truncate">{item.label}</span>
          </>
        )
        return (
          <Fragment key={item.key}>
            <ChevronRight className="size-3 shrink-0 text-slate-500" />
            {interactive ? (
              <button
                type="button"
                onClick={() => select(item.selection)}
                className={cn(
                  'flex min-w-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs',
                  last
                    ? 'bg-white/25 font-semibold text-white'
                    : 'bg-white/15 text-slate-200 hover:bg-white/25 hover:text-white',
                )}
              >
                {chip}
              </button>
            ) : (
              <span
                className={cn(
                  'flex min-w-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs',
                  last ? 'bg-white/25 font-semibold text-white' : 'bg-white/15 text-slate-200',
                )}
              >
                {chip}
              </span>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
