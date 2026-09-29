import { Fragment } from 'react'
import { ChevronRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { attributeRef, groupRef } from '@/lib/model/refs'
import { cn } from '@/lib/utils'

function shortName(name, project) {
  if (project && name.startsWith(`${project}.`)) return name.slice(project.length + 1)
  return name
}

function buildItems(selection, project) {
  if (!selection) return []
  const { objectName, groupName, attributeName } = selection
  const items = [
    {
      key: 'object',
      label: shortName(objectName, project),
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
  const select = useProjectStore((state) => state.select)
  const deleteEntry = useProjectStore((state) => state.deleteEntry)
  const entries = useProjectStore((state) => state.entries)
  const entry = selection
    ? entries.find(
        (item) => (item.qualifiedName ?? item.model?.name) === selection.objectName,
      )
    : null
  const project = entry?.namespace ? entry.namespace.split('.')[0] : null
  const items = buildItems(selection, project)

  if (items.length === 0) {
    return (
      <div className="border-b bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Aucune sélection
      </div>
    )
  }

  const handleDelete = () => {
    if (!entry) return
    if (window.confirm(`Supprimer l'objet « ${entry.model?.name} » ?`)) {
      deleteEntry(selection.objectName)
    }
  }

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
      {entry ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-destructive"
          title="Delete object"
          onClick={handleDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      ) : null}
    </div>
  )
}
