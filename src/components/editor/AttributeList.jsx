import { useState } from 'react'
import { Check, Equal, Pencil, Sigma, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { attributeRef, originKind } from '@/lib/model/refs'
import { useTranslation } from '@/lib/i18n'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { cn } from '@/lib/utils'

function insertionIndex(event, index) {
  const rect = event.currentTarget.getBoundingClientRect()
  return event.clientY > rect.top + rect.height / 2 ? index + 1 : index
}

export function AttributeList({
  objectName,
  groupName = null,
  groupIndex = null,
  attributes,
  onDragStartAttribute = null,
  onDragEndAttribute = null,
}) {
  const { t } = useTranslation()
  const addAttribute = useProjectStore((state) => state.addAttribute)
  const removeAttribute = useProjectStore((state) => state.removeAttribute)
  const reorderAttribute = useProjectStore((state) => state.reorderAttribute)
  const select = useProjectStore((state) => state.select)
  const selectedRef = useProjectStore((state) => state.selection?.ref ?? null)
  const [draft, setDraft] = useState('')
  const [dragFrom, setDragFrom] = useState(null)
  const [dropIndex, setDropIndex] = useState(null)

  const resetDrag = () => {
    setDragFrom(null)
    setDropIndex(null)
  }

  const commit = () => {
    const value = draft.trim()
    if (!value) return
    addAttribute(objectName, groupIndex, value)
    setDraft('')
  }

  const handleDelete = (index) => {
    if (window.confirm(t('attribute.delete.confirm', { name: attributes[index].name }))) {
      removeAttribute(objectName, groupIndex, index)
    }
  }

  const handleDrop = (event, index) => {
    if (dragFrom === null) return
    event.preventDefault()
    const insertAt = insertionIndex(event, index)
    const from = dragFrom
    resetDrag()
    let to = insertAt
    if (from < to) to -= 1
    if (to !== from) reorderAttribute(objectName, groupIndex, from, to)
  }

  return (
    <div
      className="flex flex-col gap-0.5"
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDropIndex(null)
      }}
    >
      {attributes.map((attribute, index) => {
        const ref = attributeRef(objectName, groupName, attribute.name)
        const kind = originKind(attribute.origin)
        const active = selectedRef === ref
        const barAbove = dropIndex === index
        const barBelow = dropIndex === attributes.length && index === attributes.length - 1
        return (
          <div
            key={ref}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', attribute.name)
              setDragFrom(index)
              onDragStartAttribute?.({
                objectName,
                groupIndex,
                attributeIndex: index,
                attributeName: attribute.name,
              })
            }}
            onDragOver={(event) => {
              if (dragFrom === null) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              const next = insertionIndex(event, index)
              if (dropIndex !== next) setDropIndex(next)
            }}
            onDrop={(event) => handleDrop(event, index)}
            onDragEnd={() => {
              resetDrag()
              onDragEndAttribute?.()
            }}
            className={cn(
              'group relative flex cursor-grab items-center gap-2 rounded px-1.5 py-0.5 hover:bg-accent active:cursor-grabbing',
              active && 'bg-accent',
              dragFrom === index && 'opacity-50',
            )}
          >
            {barAbove ? (
              <span className="pointer-events-none absolute inset-x-0 -top-[1px] z-10 h-0.5 rounded-full bg-primary" />
            ) : null}
            {barBelow ? (
              <span className="pointer-events-none absolute inset-x-0 -bottom-[1px] z-10 h-0.5 rounded-full bg-primary" />
            ) : null}
            <span
              className={cn(
                'flex size-3.5 shrink-0 items-center justify-center rounded-sm',
                kind === 'formula'
                  ? 'bg-blue-400'
                  : kind === 'linked'
                    ? 'bg-emerald-400'
                    : 'bg-zinc-200',
              )}
            >
              {kind === 'formula' ? (
                <Sigma className="size-2.5 text-white" title={t('attribute.formula')} />
              ) : kind === 'linked' ? (
                <Equal className="size-2.5 text-white" title={t('attribute.linked')} />
              ) : (
                <Pencil className="size-2.5 text-zinc-400" />
              )}
            </span>
            <button
              type="button"
              className={cn(
                'min-w-0 flex-1 truncate text-left font-mono text-xs hover:underline',
                attribute.optional ? 'font-normal italic' : 'font-medium',
              )}
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
              <span className="shrink-0 text-[10px] text-muted-foreground">{attribute.type}</span>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="size-5 shrink-0 text-destructive opacity-0 group-hover:opacity-100"
              title={t('attribute.delete.title')}
              onClick={() => handleDelete(index)}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        )
      })}

      <div className="flex items-center gap-1 px-0.5">
        <Input
          value={draft}
          placeholder={t('attribute.add.placeholder')}
          className="h-7 min-w-0 flex-1 font-normal italic placeholder:italic"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-emerald-600"
          title={t('attribute.add.title')}
          disabled={!draft.trim()}
          onClick={commit}
        >
          <Check className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
