import { useProjectStore } from '@/lib/store/useProjectStore'
import { BlurInput, FieldRow, TextAreaField } from './fields'

export function GroupForm({ entry, groupIndex, group }) {
  const setGroupField = useProjectStore((state) => state.setGroupField)
  const entryId = entry.qualifiedName

  return (
    <div className="flex flex-col gap-4">
      <FieldRow label="Nom">
        <BlurInput
          value={group.name}
          onCommit={(next) => setGroupField(entryId, groupIndex, 'name', next)}
        />
      </FieldRow>
      <TextAreaField
        label="Description"
        value={group.description}
        onChange={(value) => setGroupField(entryId, groupIndex, 'description', value)}
      />
    </div>
  )
}
