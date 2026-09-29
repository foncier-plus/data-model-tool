import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { RichText } from '@/components/wiki/RichText'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { groupRef } from '@/lib/model/refs'
import { BlurInput, FieldRow, TextAreaField, TextField } from './fields'

export function ObjectForm({ entry, model }) {
  const setObjectField = useProjectStore((state) => state.setObjectField)
  const renameObject = useProjectStore((state) => state.renameObject)
  const addGroup = useProjectStore((state) => state.addGroup)
  const removeGroup = useProjectStore((state) => state.removeGroup)
  const select = useProjectStore((state) => state.select)

  const [draft, setDraft] = useState('')

  const entryId = entry.qualifiedName
  const groups = model.groups ?? []

  const commitGroup = () => {
    const value = draft.trim()
    if (!value) return
    addGroup(entryId, value)
    setDraft('')
  }

  const handleDeleteGroup = (index) => {
    if (window.confirm(`Supprimer le groupe « ${groups[index].name} » et ses attributs ?`)) {
      removeGroup(entryId, index)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FieldRow label="Namespace">
        <BlurInput
          allowEmpty
          value={model.namespace}
          placeholder="(racine)"
          onCommit={(next) => setObjectField(entryId, 'namespace', next)}
        />
      </FieldRow>
      <FieldRow label="Nom">
        <BlurInput value={model.name} onCommit={(next) => renameObject(entryId, next)} />
      </FieldRow>
      <TextAreaField
        label="Description"
        value={model.description}
        onChange={(value) => setObjectField(entryId, 'description', value)}
      />

      <div className="flex flex-col gap-1.5">
        <TextField
          label="Documentation (about)"
          value={model.about}
          placeholder="[[guide.md#section]]"
          onChange={(value) => setObjectField(entryId, 'about', value)}
        />
        <RichText value={model.about} yamlFileName={entry.fileName} />
      </div>

      <Separator />

      <section className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Groupes ({groups.length})
        </span>

        <div className="flex items-center gap-2 rounded-md border bg-black/3 px-3 py-1">
          <Input
            value={draft}
            placeholder="nouveau groupe"
            className="h-6 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
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
          <p className="text-xs text-muted-foreground">Aucun groupe.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {groups.map((group, index) => {
              const ref = groupRef(entryId, group.name)
              const count = group.attributes?.length ?? 0
              return (
                <div
                  key={ref}
                  className="flex items-center gap-2 rounded-md border px-3 py-1 font-mono"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-xs hover:underline"
                    onClick={() =>
                      select({
                        kind: 'group',
                        objectName: entryId,
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
