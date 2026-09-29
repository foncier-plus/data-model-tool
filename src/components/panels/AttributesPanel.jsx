import { useState } from 'react'
import { Check, Pencil, Sigma, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { attributeRef } from '@/lib/model/refs'
import { cn } from '@/lib/utils'
import { resolveSelection } from '@/lib/selection'
import { useProjectStore } from '@/lib/store/useProjectStore'

export function AttributesPanel({ entries, selection }) {
  const resolved = resolveSelection(entries, selection)
  const addAttribute = useProjectStore((state) => state.addAttribute)
  const removeAttribute = useProjectStore((state) => state.removeAttribute)
  const select = useProjectStore((state) => state.select)
  const [draft, setDraft] = useState('')

  if (!resolved?.model) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Sélectionnez un objet ou un groupe pour lister ses attributs.
      </p>
    )
  }

  const { entry, model } = resolved
  const objectName = entry.qualifiedName ?? model.name
  const group = resolved.group
  const groupIndex = group ? resolved.groupIndex : null
  const groupName = group?.name ?? null
  const list = group ? (group.attributes ?? []) : (model.attributes ?? [])

  const handleDelete = (index) => {
    if (window.confirm(`Supprimer l'attribut « ${list[index].name} » ?`)) {
      removeAttribute(objectName, groupIndex, index)
    }
  }

  const commitAttribute = () => {
    const value = draft.trim()
    if (!value) return
    addAttribute(objectName, groupIndex, value)
    setDraft('')
  }

  return (
    <ScrollArea className="h-full">
      <div className="editor-fields flex flex-col gap-3 p-4">
        <span className="text-xs font-medium text-muted-foreground">
          {group ? `${group.name} · attributes` : 'Root attributes'} ({list.length})
        </span>

        <div className="flex items-center gap-2 rounded-md border px-3 py-1 bg-black/3">
          <Input
            value={draft}
            placeholder="new attribute name"
            className="bg-transparent h-6 border-0 px-0 shadow-none focus-visible:ring-0"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitAttribute()
              }
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-emerald-600"
            disabled={!draft.trim()}
            onClick={commitAttribute}
          >
            <Check className="size-3.5" />
          </Button>
        </div>

        {list.length === 0 ? (
          <p className="text-xs text-muted-foreground">No attribute.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {list.map((attribute, index) => {
              const ref = attributeRef(objectName, groupName, attribute.name)
              const iconClass = 'size-2.5 text-zinc-400'
              return (
                <div key={ref} className="flex items-center gap-2 rounded-md font-mono border px-2 py-1">
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-sm',
                      attribute.origin ? 'bg-blue-400' : 'bg-zinc-200',
                    )}
                  >
                    {attribute.origin ? (
                      <Sigma className="size-2.5 text-white" title="Derived attribute" />
                    ) : (
                      <Pencil className={iconClass} />
                    )}
                  </span>
                  <button
                    type="button"
                    className={`min-w-0 flex-1 truncate text-left text-xs hover:underline ${
                      attribute.optional ? 'font-normal italic' : 'font-medium'
                    }`}
                    onClick={() =>
                      select({
                        kind: 'attribute',
                        objectName,
                        groupName,
                        attributeName: attribute.name,
                        ref,
                      })
                    }
                  >
                    {attribute.name}
                    {attribute.example ? (
                      <span className="font-normal italic text-muted-foreground">
                        {' '}
                        · {attribute.example}
                      </span>
                    ) : null}
                  </button>
                  {attribute.type ? (
                    <span className="text-[10px] text-muted-foreground">{attribute.type}</span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-destructive"
                    onClick={() => handleDelete(index)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
