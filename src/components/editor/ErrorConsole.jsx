import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ErrorConsole({ diagnostics = [], onSelectLine }) {
  const [open, setOpen] = useState(true)

  if (diagnostics.length === 0) {
    return (
      <div className="flex items-center gap-2 border-t bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
        <CircleAlert className="size-3.5" />
        Console — aucune erreur
      </div>
    )
  }

  return (
    <div className="flex max-h-40 flex-col border-t bg-muted/40">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium hover:bg-accent"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <AlertTriangle className="size-3.5 text-destructive" />
        Console de traitement
        <span className="rounded-full bg-destructive/15 px-1.5 text-[10px] text-destructive">
          {diagnostics.length}
        </span>
      </button>
      {open ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-auto px-1 pb-1">
          {diagnostics.map((item, index) => (
            <button
              key={`${item.message}-${index}`}
              type="button"
              onClick={() => onSelectLine?.(item)}
              className={cn(
                'flex items-start gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent',
                item.severity === 'warning' ? 'text-amber-600' : 'text-destructive',
              )}
            >
              {item.line ? (
                <span className="shrink-0 font-mono text-muted-foreground">
                  L{item.line}:{item.col ?? 1}
                </span>
              ) : (
                <span className="shrink-0 text-muted-foreground">—</span>
              )}
              <span className="min-w-0 break-words">{item.message}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
