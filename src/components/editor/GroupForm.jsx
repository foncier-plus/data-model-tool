import { useProjectStore } from '@/lib/store/useProjectStore'
import { BlurInput, FieldRow, TextAreaField } from './fields'

export function GroupForm({ entry, groupIndex, group }) {
  const setGroupField = useProjectStore((state) => state.setGroupField)
  const fileName = entry.fileName

  return (
    <div className="flex flex-col gap-4">
      <FieldRow label="Name">
        <BlurInput
          value={group.name}
          onCommit={(next) => setGroupField(fileName, groupIndex, 'name', next)}
        />
      </FieldRow>
      <TextAreaField
        label="Description"
        value={group.description}
        onChange={(value) => setGroupField(fileName, groupIndex, 'description', value)}
      />
    </div>
  )
}
