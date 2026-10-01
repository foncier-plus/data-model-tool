import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Settings } from 'lucide-react'
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

export function GraphSettings({ settings, onChange, issueGroups = [], onSelectIssue }) {
  const [open, setOpen] = useState(false)
  const [issuesOpen, setIssuesOpen] = useState(false)
  const ref = useRef(null)
  const issueCount = issueGroups.reduce((total, group) => total + group.issues.length, 0)

  useEffect(() => {
    if (!open && !issuesOpen) return undefined
    const onMouseDown = (event) => {
      if (!ref.current?.contains(event.target)) {
        setOpen(false)
        setIssuesOpen(false)
      }
    }
    window.addEventListener('mousedown', onMouseDown)
    return () => window.removeEventListener('mousedown', onMouseDown)
  }, [open, issuesOpen])

  return (
    <div ref={ref} className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        {issueCount > 0 ? (
          <button
            type="button"
            title={`${issueCount} problème${issueCount > 1 ? 's' : ''} dans le graphe`}
            aria-label="Problèmes du graphe"
            aria-expanded={issuesOpen}
            onClick={() => {
              setIssuesOpen((value) => !value)
              setOpen(false)
            }}
            className={cn(
              'flex h-8 items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2 text-xs font-medium text-destructive shadow-sm backdrop-blur hover:bg-destructive/20',
              issuesOpen && 'bg-destructive/20',
            )}
          >
            <AlertTriangle className="size-3.5" />
            {issueCount}
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Paramètres du graphe"
          aria-expanded={open}
          onClick={() => {
            setOpen((value) => !value)
            setIssuesOpen(false)
          }}
          className={cn(
            'flex size-8 items-center justify-center rounded-lg border bg-background/95 text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground',
            open && 'bg-accent text-foreground',
          )}
        >
          <Settings className="size-4" />
        </button>
      </div>

      {issuesOpen ? (
        <div className="flex max-h-80 w-96 flex-col overflow-hidden rounded-lg border bg-background/95 shadow-lg backdrop-blur">
          <div className="border-b px-3 py-2 text-xs font-semibold">
            Problèmes du graphe ({issueCount})
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2">
            {issueGroups.map((group) => (
              <div key={group.objectName} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 px-1">
                  <span className="truncate text-xs font-semibold">{group.label}</span>
                  <span className="truncate font-mono text-[10px] text-muted-foreground">
                    {group.objectName}
                  </span>
                  <span className="ml-auto shrink-0 rounded-full bg-destructive/15 px-1.5 text-[10px] text-destructive">
                    {group.issues.length}
                  </span>
                </div>
                {group.issues.map((issue, index) => (
                  <button
                    key={`${issue.code}-${issue.ref}-${index}`}
                    type="button"
                    onClick={() => {
                      onSelectIssue?.(issue)
                      setIssuesOpen(false)
                    }}
                    className="flex items-start gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    <code className="shrink-0 rounded bg-muted px-1 text-[10px]">{issue.code}</code>
                    <span className="min-w-0 flex-1 break-words">{issue.message}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
            <Toggle
              label="Afficher les objets parents"
              checked={settings.showParentObjects}
              onChange={(value) => onChange({ showParentObjects: value })}
            />
          </Section>
        </div>
      ) : null}
    </div>
  )
}
