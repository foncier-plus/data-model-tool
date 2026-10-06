import { Fragment } from 'react'
import { ChevronRight, FileCode } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { attributeRef, groupRef } from '@/lib/model/refs'
import { cn } from '@/lib/utils'

function buildItems(selection, objectLabel) {
  if (!selection) return []
  const { objectName, groupName, attributeName } = selection
  const items = [
    {
      key: 'object',
      label: objectLabel ?? objectName,
      selection: {
        kind: 'object',
        objectName,
        groupName: null,
        attributeName: null,
        ref: objectName,
      },
    },
  ]
  if (groupName) {
    items.push({
      key: 'group',
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

export function Breadcrumb({ selection }) {
  const { t } = useTranslation()
  const select = useProjectStore((state) => state.select)
  const revealSelection = useProjectStore((state) => state.revealSelection)
  const entries = useProjectStore((state) => state.entries)
  const entry = selection
    ? entries.find(
        (item) => (item.qualifiedName ?? item.model?.name) === selection.objectName,
      )
    : null
  const items = buildItems(selection, entry?.model?.name)

  if (items.length === 0) {
    return (
      <div className="border-b bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {t('breadcrumb.noSelection')}
      </div>
    )
  }

  const fileName = entry?.fileName
  const baseName = fileName ? fileName.split('/').pop() : null

  return (
    <div className="flex items-center gap-1 border-b bg-muted/50 px-2 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 ? <ChevronRight className="size-3 shrink-0 text-muted-foreground" /> : null}
            <button
              type="button"
              onClick={() => select(item.selection)}
              className={cn(
                'truncate text-xs',
                index === items.length - 1
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          </Fragment>
        ))}
      </div>
      {fileName ? (
        <button
          type="button"
          title={fileName}
          onClick={() => revealSelection(selection)}
          className="flex max-w-40 shrink-0 items-center gap-1 truncate rounded px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <FileCode className="size-3 shrink-0" />
          <span className="truncate">{baseName}</span>
        </button>
      ) : null}
    </div>
  )
}
