import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { groupRef } from '@/lib/model/refs'
import { BlurInput, FieldRow, TextAreaField } from './fields'

export function ObjectForm({ entry, model }) {
  const setObjectField = useProjectStore((state) => state.setObjectField)
  const renameObject = useProjectStore((state) => state.renameObject)
  const addGroup = useProjectStore((state) => state.addGroup)
  const removeGroup = useProjectStore((state) => state.removeGroup)
  const select = useProjectStore((state) => state.select)

  const [draft, setDraft] = useState('')

  const fileName = entry.fileName
  const objectName = entry.qualifiedName ?? model.name
  const groups = model.groups ?? []

  const commitGroup = () => {
    const value = draft.trim()
    if (!value) return
    addGroup(fileName, value)
    setDraft('')
  }

  const handleDeleteGroup = (index) => {
    if (window.confirm(`Delete group "${groups[index].name}" and its attributes?`)) {
      removeGroup(fileName, index)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FieldRow label="Name">
        <BlurInput value={model.name} onCommit={(next) => renameObject(fileName, next)} />
      </FieldRow>
      <TextAreaField
        label="Description"
        value={model.description}
        onChange={(value) => setObjectField(fileName, 'description', value)}
      />

      <Separator />

      <section className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Groups ({groups.length})</span>

        <div className="flex items-center gap-2 rounded-md border px-3 py-1 bg-black/3">
          <Input
            value={draft}
            placeholder="new group name"
            className="h-6 bg-transparent border-0 px-0 shadow-none focus-visible:ring-0"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitGroup()
              }
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-emerald-600"
            disabled={!draft.trim()}
            onClick={commitGroup}
          >
            <Check className="size-3.5" />
          </Button>
        </div>

        {groups.length === 0 ? (
          <p className="text-xs text-muted-foreground">No group.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {groups.map((group, index) => {
              const ref = groupRef(objectName, group.name)
              const count = group.attributes?.length ?? 0
              return (
                <div key={ref} className="flex font-mono items-center gap-2 rounded-md border px-3 py-1">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-xs hover:underline"
                    onClick={() =>
                      select({
                        kind: 'group',
                        objectName,
                        groupName: group.name,
                        attributeName: null,
                        ref,
                      })
                    }
                  >
                    {group.name}
                  </button>
                  <span className="text-[10px] text-muted-foreground">
                    {count} attr{count > 1 ? 's' : ''}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-destructive"
                    onClick={() => handleDeleteGroup(index)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
