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
import { useProjectStore } from '@/lib/store/useProjectStore'
import { BlurInput, FieldRow, TextAreaField, TypeField } from './fields'
import { OriginForm } from './OriginForm'

export function AttributeForm({ entry, entries, groupIndex, attributeIndex, attribute, resetKey }) {
  const setAttributeField = useProjectStore((state) => state.setAttributeField)
  const moveAttributeToGroup = useProjectStore((state) => state.moveAttributeToGroup)

  const [groupDraft, setGroupDraft] = useState('')
  const [lastKey, setLastKey] = useState(resetKey)

  const fileName = entry.fileName
  const group = groupIndex === null ? null : entry.model?.groups?.[groupIndex]
  const groups = entry.model?.groups ?? []

  if (resetKey !== lastKey) {
    setLastKey(resetKey)
    setGroupDraft(group?.name ?? '')
  }

  const commitGroup = () => {
    const value = groupDraft.trim()
    if (value === (group?.name ?? '')) return
    moveAttributeToGroup(fileName, groupIndex, attributeIndex, value)
  }

  const clearGroup = () => {
    setGroupDraft('')
    if (group) moveAttributeToGroup(fileName, groupIndex, attributeIndex, '')
  }

  return (
    <div className="flex flex-col gap-4">
      <FieldRow label="Group">
        <div className="flex items-center gap-2 px-3 py-1 bg-black/3 rounded-md">
          <Input
            list="attribute-group-options"
            value={groupDraft}
            placeholder="group (empty = root attributes)"
            className="bg-transparent h-7 border-0 px-0 shadow-none focus-visible:ring-0"
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
              title="Remove from group"
              onClick={clearGroup}
            >
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </FieldRow>

      <FieldRow label="Name">
        <BlurInput
          value={attribute.name}
          onCommit={(next) => setAttributeField(fileName, groupIndex, attributeIndex, 'name', next)}
        />
      </FieldRow>

      <FieldRow label="Type">
        <TypeField
          label={null}
          value={attribute.type}
          onChange={(value) =>
            setAttributeField(fileName, groupIndex, attributeIndex, 'type', value)
          }
        />
      </FieldRow>

      <FieldRow label="Presence">
        <Select
          value={attribute.optional ? 'optional' : 'mandatory'}
          onValueChange={(value) =>
            setAttributeField(
              fileName,
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
            <SelectItem value="mandatory">mandatory</SelectItem>
            <SelectItem value="optional">optional</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Example">
        <Input
          className="italic"
          value={attribute.example ?? ''}
          placeholder="example value"
          onChange={(event) =>
            setAttributeField(fileName, groupIndex, attributeIndex, 'example', event.target.value)
          }
          onBlur={(event) =>
            setAttributeField(fileName, groupIndex, attributeIndex, 'example', event.target.value)
          }
        />
      </FieldRow>

      <TextAreaField
        label="Description"
        value={attribute.description}
        onChange={(value) =>
          setAttributeField(fileName, groupIndex, attributeIndex, 'description', value)
        }
      />

      <OriginForm
        origin={attribute.origin}
        entries={entries}
        resetKey={resetKey}
        onChange={(origin) =>
          setAttributeField(fileName, groupIndex, attributeIndex, 'origin', origin)
        }
      />
    </div>
  )
}
