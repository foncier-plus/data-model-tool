import { useState } from 'react'
import { Boxes, Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { FormulaPanel } from '@/components/panels/FormulaPanel'
import { useTranslation, pluralKey } from '@/lib/i18n'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { groupRef } from '@/lib/model/refs'
import { cn } from '@/lib/utils'
import { AttributeList } from './AttributeList'
import { DocumentationField } from './DocumentationField'
import { BlurInput, FieldRow, MarkdownField, PanelSwitch } from './fields'

function insertionIndex(event, index) {
  const rect = event.currentTarget.getBoundingClientRect()
  return event.clientY > rect.top + rect.height / 2 ? index + 1 : index
}

export function ObjectForm({ entry, model }) {
  const { t, language } = useTranslation()
  const setObjectField = useProjectStore((state) => state.setObjectField)
  const renameObject = useProjectStore((state) => state.renameObject)
  const addGroup = useProjectStore((state) => state.addGroup)
  const removeGroup = useProjectStore((state) => state.removeGroup)
  const moveGroup = useProjectStore((state) => state.moveGroup)
  const moveAttribute = useProjectStore((state) => state.moveAttribute)
  const select = useProjectStore((state) => state.select)
  const panelTab = useProjectStore((state) => state.panelTab)
  const setPanelTab = useProjectStore((state) => state.setPanelTab)

  const [draft, setDraft] = useState('')
  const [dragging, setDragging] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [draggingGroup, setDraggingGroup] = useState(null)
  const [groupDropIndex, setGroupDropIndex] = useState(null)

  const entryId = entry.qualifiedName
  const groups = model.groups ?? []
  const rootAttributes = model.attributes ?? []

  const resetDrag = () => {
    setDropTarget(null)
    setDragging(null)
    setGroupDropIndex(null)
    setDraggingGroup(null)
  }

  const dragProps = (groupIndex) => ({
    onDragOver: (event) => {
      if (draggingGroup !== null) {
        if (draggingGroup === groupIndex) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        const next = insertionIndex(event, groupIndex)
        if (groupDropIndex !== next) setGroupDropIndex(next)
        return
      }
      if (!dragging || dragging.groupIndex === groupIndex) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      if (dropTarget !== groupIndex) setDropTarget(groupIndex)
    },
    onDragLeave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setDropTarget((current) => (current === groupIndex ? null : current))
        setGroupDropIndex(null)
      }
    },
    onDrop: (event) => {
      if (draggingGroup !== null) {
        if (draggingGroup === groupIndex) return
        event.preventDefault()
        const from = draggingGroup
        const insertAt = insertionIndex(event, groupIndex)
        resetDrag()
        let to = insertAt
        if (from < to) to -= 1
        if (to !== from) moveGroup(entryId, from, to)
        return
      }
      if (!dragging || dragging.groupIndex === groupIndex) return
      event.preventDefault()
      const source = dragging
      resetDrag()
      moveAttribute(entryId, source.groupIndex, source.attributeIndex, groupIndex)
    },
  })

  const commitGroup = () => {
    const value = draft.trim()
    if (!value) return
    addGroup(entryId, value)
    setDraft('')
  }

  const handleDeleteGroup = (index) => {
    const message = t('group.delete.confirm', { name: groups[index].name })
    if (window.confirm(message)) {
      removeGroup(entryId, index)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FieldRow label={t('field.namespace')}>
        <BlurInput
          allowEmpty
          value={model.namespace}
          placeholder={t('field.namespaceRoot')}
          onCommit={(next) => setObjectField(entryId, 'namespace', next)}
        />
      </FieldRow>
      <FieldRow label={t('field.name')}>
        <BlurInput value={model.name} onCommit={(next) => renameObject(entryId, next)} />
      </FieldRow>

      <MarkdownField
        label={t('field.description')}
        value={model.description}
        onChange={(value) => setObjectField(entryId, 'description', value)}
      />

      <DocumentationField
        value={model.about}
        yamlFileName={entry.fileName}
        onChange={(value) => setObjectField(entryId, 'about', value)}
      />

      <PanelSwitch
        value={panelTab}
        onChange={setPanelTab}
        options={[
          { value: 'edit', label: t('switch.attributesGroups') },
          { value: 'formula', label: t('switch.formulas') },
        ]}
      />

      {panelTab === 'formula' ? (
        <FormulaPanel />
      ) : (
        <>
          <section className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t('object.attributes', { count: rootAttributes.length })}
            </span>
            <AttributeList
              objectName={entryId}
              attributes={rootAttributes}
              onDragStartAttribute={setDragging}
              onDragEndAttribute={resetDrag}
            />
          </section>

      <Separator />

      <section className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {t('object.groups', { count: groups.length })}
        </span>

        <div className="flex flex-col gap-0.5">
          {groups.map((group, index) => {
            const ref = groupRef(entryId, group.name)
            const count = group.attributes?.length ?? 0
            const isTarget = dropTarget === index
            const barAbove = draggingGroup !== null && groupDropIndex === index
            const barBelow =
              draggingGroup !== null &&
              groupDropIndex === groups.length &&
              index === groups.length - 1
            return (
              <div
                key={ref}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', group.name)
                  setDraggingGroup(index)
                }}
                onDragEnd={resetDrag}
                {...dragProps(index)}
                className={cn(
                  'group relative flex cursor-grab items-center gap-2 rounded px-1.5 py-0.5 hover:bg-accent active:cursor-grabbing',
                  isTarget && 'bg-accent ring-1 ring-ring',
                  draggingGroup === index && 'opacity-50',
                )}
              >
                {barAbove ? (
                  <span className="pointer-events-none absolute inset-x-0 -top-[1px] z-10 h-0.5 rounded-full bg-primary" />
                ) : null}
                {barBelow ? (
                  <span className="pointer-events-none absolute inset-x-0 -bottom-[1px] z-10 h-0.5 rounded-full bg-primary" />
                ) : null}
                <span className="flex size-3.5 shrink-0 items-center justify-center rounded-sm bg-zinc-200 text-zinc-500">
                  <Boxes className="size-2.5" />
                </span>
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left font-mono text-xs font-medium hover:underline"
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
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {t(pluralKey(language, 'attribute.count', count), { count })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 shrink-0 text-destructive opacity-0 group-hover:opacity-100"
                  title={t('group.delete.title')}
                  onClick={() => handleDeleteGroup(index)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-1">
          <Input
            value={draft}
            placeholder={t('group.add.placeholder')}
            className="h-7 min-w-0 flex-1 font-normal italic placeholder:italic"
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
            className="size-6 shrink-0 text-emerald-600"
            title={t('group.add.title')}
            disabled={!draft.trim()}
            onClick={commitGroup}
          >
            <Check className="size-3.5" />
          </Button>
        </div>
      </section>
        </>
      )}
    </div>
  )
}
