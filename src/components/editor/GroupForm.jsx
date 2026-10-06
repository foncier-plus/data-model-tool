import { useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { FormulaPanel } from '@/components/panels/FormulaPanel'
import { useTranslation } from '@/lib/i18n'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { cn } from '@/lib/utils'
import { AttributeList } from './AttributeList'
import { BlurInput, FieldRow, MarkdownField, PanelSwitch } from './fields'

export function GroupForm({ entry, groupIndex, group }) {
  const { t } = useTranslation()
  const setGroupField = useProjectStore((state) => state.setGroupField)
  const moveAttribute = useProjectStore((state) => state.moveAttribute)
  const panelTab = useProjectStore((state) => state.panelTab)
  const setPanelTab = useProjectStore((state) => state.setPanelTab)
  const [dragging, setDragging] = useState(null)
  const [isRootTarget, setIsRootTarget] = useState(false)

  const entryId = entry.qualifiedName
  const attributes = group.attributes ?? []

  const resetDrag = () => {
    setDragging(null)
    setIsRootTarget(false)
  }

  const rootDragProps = {
    onDragOver: (event) => {
      if (!dragging) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setIsRootTarget(true)
    },
    onDragLeave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setIsRootTarget(false)
    },
    onDrop: (event) => {
      if (!dragging) return
      event.preventDefault()
      const source = dragging
      resetDrag()
      moveAttribute(entryId, source.groupIndex, source.attributeIndex, null)
    },
  }

  return (
    <div className="flex flex-col gap-4">
      <FieldRow label={t('field.name')}>
        <BlurInput
          value={group.name}
          onCommit={(next) => setGroupField(entryId, groupIndex, 'name', next)}
        />
      </FieldRow>

      <MarkdownField
        label={t('field.description')}
        value={group.description}
        onChange={(value) => setGroupField(entryId, groupIndex, 'description', value)}
      />

      <PanelSwitch
        value={panelTab}
        onChange={setPanelTab}
        options={[
          { value: 'edit', label: t('switch.attributes') },
          { value: 'formula', label: t('switch.formulas') },
        ]}
      />

      {panelTab === 'formula' ? (
        <FormulaPanel />
      ) : (
        <section className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t('object.attributes', { count: attributes.length })}
          </span>
          <div
            {...rootDragProps}
            className={cn(
              'flex h-7 items-center gap-1 rounded-md border border-dashed border-border px-2 font-mono text-[11px] text-muted-foreground',
              isRootTarget && 'border-ring bg-accent/40 text-foreground',
            )}
          >
            <ArrowUp className="size-3 shrink-0" />
            <span className="truncate">{t('group.rootZone')}</span>
          </div>
          <AttributeList
            objectName={entryId}
            groupName={group.name}
            groupIndex={groupIndex}
            attributes={attributes}
            onDragStartAttribute={setDragging}
            onDragEndAttribute={resetDrag}
          />
        </section>
      )}
    </div>
  )
}
