import { useState } from 'react'
import { Check, FileText, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseWikiLink } from '@/lib/model/wiki'
import { useTranslation } from '@/lib/i18n'
import { useProjectStore } from '@/lib/store/useProjectStore'

export function DocumentationField({ value, yamlFileName, onChange }) {
  const { t } = useTranslation()
  const openWikiLink = useProjectStore((state) => state.openWikiLink)
  const link = parseWikiLink(value)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEdit = () => {
    setDraft(value ?? '')
    setEditing(true)
  }

  const commit = () => {
    onChange(draft.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          value={draft}
          placeholder={t('doc.placeholder')}
          className="min-w-0 flex-1"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
            if (event.key === 'Escape') setEditing(false)
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-emerald-600"
          title={t('doc.validate')}
          onClick={commit}
        >
          <Check className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground"
          title={t('doc.cancel')}
          onClick={() => setEditing(false)}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {link ? (
        <button
          type="button"
          onClick={() => openWikiLink(yamlFileName, link.path, link.section)}
          className="flex h-7 min-w-0 flex-1 items-center gap-1 truncate rounded-md border border-border bg-card px-2 text-xs text-primary hover:bg-accent"
        >
          <FileText className="size-3 shrink-0" />
          <span className="truncate">
            {link.path}
            {link.section ? `#${link.section}` : ''}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className="h-7 min-w-0 flex-1 truncate rounded-md border border-border bg-card px-2 text-left text-xs text-muted-foreground italic hover:bg-accent"
        >
          {value || t('doc.add')}
        </button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-6 shrink-0 text-muted-foreground"
        title={t('doc.edit')}
        onClick={startEdit}
      >
        <Pencil className="size-3.5" />
      </Button>
    </div>
  )
}
