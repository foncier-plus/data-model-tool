import { useEffect, useRef, useState } from 'react'
import { Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-xs">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
        className="size-3.5 cursor-pointer accent-primary"
      />
    </label>
  )
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </span>
      {children}
    </div>
  )
}

export function GraphSettings({ settings, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onMouseDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false)
    }
    window.addEventListener('mousedown', onMouseDown)
    return () => window.removeEventListener('mousedown', onMouseDown)
  }, [open])

  return (
    <div ref={ref} className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1.5">
      <button
        type="button"
        aria-label="Paramètres du graphe"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex size-8 items-center justify-center rounded-lg border bg-background/95 text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground',
          open && 'bg-accent text-foreground',
        )}
      >
        <Settings className="size-4" />
      </button>

      {open ? (
        <div className="flex w-60 flex-col gap-3 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
          <Section title="Groupes">
            <Toggle
              label="Groupe racine"
              checked={settings.rootGroup}
              onChange={(value) => onChange({ rootGroup: value })}
            />
            <Toggle
              label="Repliement par défaut"
              checked={settings.autoCollapse}
              onChange={(value) => onChange({ autoCollapse: value })}
            />
          </Section>

          <Section title="Relations">
            <Toggle
              label="Relations entre les attributs"
              checked={settings.attributeRelations}
              onChange={(value) => onChange({ attributeRelations: value })}
            />
          </Section>
        </div>
      ) : null}
    </div>
  )
}
