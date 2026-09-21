import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ATTRIBUTE_TYPES } from '@/lib/model/schema'
import { cn } from '@/lib/utils'

export function FieldRow({ label, children, className }) {
  return (
    <div className={cn('grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function TextField({ label, value, onChange, placeholder, disabled }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
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

export function BlurInput({ label, value, onCommit, placeholder, hint }) {
  const [draft, setDraft] = useState(value ?? '')
  const [lastValue, setLastValue] = useState(value ?? '')

  if ((value ?? '') !== lastValue) {
    setLastValue(value ?? '')
    setDraft(value ?? '')
  }

  const commit = () => {
    const next = draft.trim()
    if (next && next !== value) onCommit(next)
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
