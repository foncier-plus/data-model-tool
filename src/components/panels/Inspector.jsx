import { MousePointerClick } from 'lucide-react'
import { AttributeForm } from '@/components/editor/AttributeForm'
import { GroupForm } from '@/components/editor/GroupForm'
import { ObjectForm } from '@/components/editor/ObjectForm'
import { ScrollArea } from '@/components/ui/scroll-area'
import { resolveSelection } from '@/lib/selection'

export function Inspector({ entries, selection }) {
  const resolved = resolveSelection(entries, selection)

  if (!resolved) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <MousePointerClick className="size-5" />
        <p>Select an object, a group or an attribute to edit it.</p>
      </div>
    )
  }

  const resetKey = selection?.ref ?? resolved.entry.fileName

  return (
    <ScrollArea className="h-full">
      <div className="editor-fields p-4">
        {selection.kind === 'object' ? (
          <ObjectForm entry={resolved.entry} model={resolved.model} />
        ) : null}
        {selection.kind === 'group' && resolved.group ? (
          <GroupForm
            entry={resolved.entry}
            groupIndex={resolved.groupIndex}
            group={resolved.group}
          />
        ) : null}
        {selection.kind === 'attribute' && resolved.attribute ? (
          <AttributeForm
            entry={resolved.entry}
            entries={entries}
            groupIndex={resolved.groupIndex}
            attributeIndex={resolved.attributeIndex}
            attribute={resolved.attribute}
            resetKey={resetKey}
          />
        ) : null}
      </div>
    </ScrollArea>
  )
}
