import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RichText } from '@/components/wiki/RichText'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { BlurInput, FieldRow, TextAreaField, TextField, TypeField } from './fields'
import { OriginForm } from './OriginForm'

export function AttributeForm({ entry, entries, groupIndex, attributeIndex, attribute, resetKey }) {
  const setAttributeField = useProjectStore((state) => state.setAttributeField)
  const moveAttributeToGroup = useProjectStore((state) => state.moveAttributeToGroup)

  const [groupDraft, setGroupDraft] = useState('')
  const [lastKey, setLastKey] = useState(resetKey)

  const entryId = entry.qualifiedName
  const group = groupIndex === null ? null : entry.model?.groups?.[groupIndex]
  const groups = entry.model?.groups ?? []

  if (resetKey !== lastKey) {
    setLastKey(resetKey)
    setGroupDraft(group?.name ?? '')
  }

  const commitGroup = () => {
    const value = groupDraft.trim()
    if (value === (group?.name ?? '')) return
    moveAttributeToGroup(entryId, groupIndex, attributeIndex, value)
  }

  const clearGroup = () => {
    setGroupDraft('')
    if (group) moveAttributeToGroup(entryId, groupIndex, attributeIndex, '')
  }

  return (
    <div className="flex flex-col gap-4">
      <FieldRow label="Groupe">
        <div className="flex items-center gap-2 rounded-md bg-black/3 px-3 py-1">
          <Input
            list="attribute-group-options"
            value={groupDraft}
            placeholder="groupe (vide = racine)"
            className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            onChange={(event) => setGroupDraft(event.target.value)}
            onBlur={commitGroup}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
          />
          <datalist id="attribute-group-options">
            {groups.map((item) => (
              <option key={item.name} value={item.name} />
            ))}
          </datalist>
          {group ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground"
              title="Retirer du groupe"
              onClick={clearGroup}
            >
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </FieldRow>

      <FieldRow label="Nom">
        <BlurInput
          value={attribute.name}
          onCommit={(next) => setAttributeField(entryId, groupIndex, attributeIndex, 'name', next)}
        />
      </FieldRow>

      <FieldRow label="Type">
        <TypeField
          label={null}
          value={attribute.type}
          onChange={(value) =>
            setAttributeField(entryId, groupIndex, attributeIndex, 'type', value)
          }
        />
      </FieldRow>

      <FieldRow label="Présence">
        <Select
          value={attribute.optional ? 'optional' : 'mandatory'}
          onValueChange={(value) =>
            setAttributeField(
              entryId,
              groupIndex,
              attributeIndex,
              'optional',
              value === 'optional',
            )
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mandatory">obligatoire</SelectItem>
            <SelectItem value="optional">optionnel</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Exemple">
        <Input
          className="italic"
          value={attribute.example ?? ''}
          placeholder="valeur d'exemple"
          onChange={(event) =>
            setAttributeField(entryId, groupIndex, attributeIndex, 'example', event.target.value)
          }
          onBlur={(event) =>
            setAttributeField(entryId, groupIndex, attributeIndex, 'example', event.target.value)
          }
        />
      </FieldRow>

      <TextAreaField
        label="Description"
        value={attribute.description}
        onChange={(value) =>
          setAttributeField(entryId, groupIndex, attributeIndex, 'description', value)
        }
      />

      <div className="flex flex-col gap-1.5">
        <TextField
          label="Documentation (about)"
          value={attribute.about}
          placeholder="[[guide.md#section]]"
          onChange={(value) =>
            setAttributeField(entryId, groupIndex, attributeIndex, 'about', value)
          }
        />
        <RichText value={attribute.about} yamlFileName={entry.fileName} />
      </div>

      <OriginForm
        origin={attribute.origin}
        entries={entries}
        namespace={entry.namespace ?? null}
        resetKey={resetKey}
        onChange={(origin) =>
          setAttributeField(entryId, groupIndex, attributeIndex, 'origin', origin)
        }
      />
    </div>
  )
}
