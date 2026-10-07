import { useMemo, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BlurInput, FieldRow, MarkdownField } from '@/components/editor/fields'
import { setProjectField, setProjectList } from '@/lib/model/projectMutations'
import { parseProjectManifest } from '@/lib/model/projectManifest'
import { useTranslation } from '@/lib/i18n'

function ListSection({ title, items, placeholder, onChange }) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const value = draft.trim()
    if (!value) return
    if (!items.includes(value)) onChange([...items, value])
    setDraft('')
  }

  return (
    <section className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      <div className="flex flex-col gap-0.5">
        {items.map((item, index) => (
          <div key={`${item}-${index}`} className="group flex items-center gap-1">
            <Input
              value={item}
              className="h-7 min-w-0 flex-1"
              onChange={(event) =>
                onChange(items.map((value, i) => (i === index ? event.target.value : value)))
              }
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-destructive opacity-0 group-hover:opacity-100"
              title="Retirer"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={draft}
            placeholder={placeholder}
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
            title="Ajouter"
            disabled={!draft.trim()}
            onClick={commit}
          >
            <Check className="size-3.5" />
          </Button>
        </div>
      </div>
    </section>
  )
}

export function ProjectForm({ fileName, text, onChange }) {
  const { t } = useTranslation()
  const manifest = useMemo(() => parseProjectManifest(fileName, text), [fileName, text])
  const setField = (key, value) => onChange(setProjectField(text, key, value))
  const setList = (key, items) => onChange(setProjectList(text, key, items))

  return (
    <div className="editor-fields flex flex-col gap-4 p-4">
      <FieldRow label={t('project.field.title')}>
        <BlurInput value={manifest.title} onCommit={(value) => setField('title', value)} />
      </FieldRow>

      <MarkdownField
        label={t('field.description')}
        value={manifest.description}
        onChange={(value) => setField('description', value)}
      />

      <Separator />

      <ListSection
        title={`${t('project.field.include')} (${manifest.include.length})`}
        items={manifest.include}
        placeholder={t('project.addInclude')}
        onChange={(items) => setList('include', items)}
      />

      <Separator />

      <ListSection
        title={`${t('project.field.exclude')} (${manifest.exclude.length})`}
        items={manifest.exclude}
        placeholder={t('project.addExclude')}
        onChange={(items) => setList('exclude', items)}
      />
    </div>
  )
}
