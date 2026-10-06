import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Pencil } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ATTRIBUTE_TYPES } from '@/lib/model/schema'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function FieldRow({ label, children, className }) {
  return (
    <div className={cn('grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function PanelSwitch({ value, onChange, options }) {
  return (
    <div className="flex gap-0.5 rounded-full border border-border p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded-full px-2 py-1 text-xs transition-colors',
            value === option.value
              ? 'bg-primary font-semibold text-primary-foreground'
              : 'font-normal text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function TextField({ label, value, onChange, placeholder, disabled }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? <Label className="text-xs text-muted-foreground">{label}</Label> : null}
      <Input
        value={value ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function MarkdownField({ label, value, onChange, placeholder, rows = 4 }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const emptyLabel = placeholder ?? t('description.add')

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        {label ? <Label className="text-xs text-muted-foreground">{label}</Label> : null}
        <Textarea
          autoFocus
          value={value ?? ''}
          placeholder={emptyLabel}
          rows={rows}
          className="px-2 py-1.5 font-mono text-xs"
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setEditing(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label ? <Label className="text-xs text-muted-foreground">{label}</Label> : null}
      <button
        type="button"
        title={t('field.edit')}
        onClick={() => setEditing(true)}
        className="group relative min-h-9 w-full rounded-md border border-border bg-card px-2 py-1.5 text-left"
      >
        {value ? (
          <div className="font-mono text-xs break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_em]:italic [&_h1]:mt-0 [&_h1]:text-sm [&_h2]:mt-1 [&_h2]:text-sm [&_h3]:mt-1 [&_h3]:text-xs [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_strong]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          </div>
        ) : (
          <span className="font-mono text-xs text-muted-foreground italic">{emptyLabel}</span>
        )}
        <Pencil className="absolute top-2 right-2 size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    </div>
  )
}

export function TextAreaField({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Textarea
        value={value ?? ''}
        placeholder={placeholder}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function BlurInput({ label, value, onCommit, placeholder, hint, allowEmpty = false }) {
  const [draft, setDraft] = useState(value ?? '')
  const [lastValue, setLastValue] = useState(value ?? '')

  if ((value ?? '') !== lastValue) {
    setLastValue(value ?? '')
    setDraft(value ?? '')
  }

  const commit = () => {
    const next = draft.trim()
    const changed = allowEmpty ? next !== (value ?? '') : Boolean(next) && next !== value
    if (changed) onCommit(next)
    else setDraft(value ?? '')
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label ? <Label className="text-xs text-muted-foreground">{label}</Label> : null}
      <Input
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') setDraft(value ?? '')
        }}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function TypeField({ label = 'Type', value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? <Label className="text-xs text-muted-foreground">{label}</Label> : null}
      <Input
        list="attribute-type-options"
        value={value ?? ''}
        placeholder="string"
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id="attribute-type-options">
        {ATTRIBUTE_TYPES.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
    </div>
  )
}
