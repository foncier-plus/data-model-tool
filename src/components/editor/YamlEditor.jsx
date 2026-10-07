import { useCallback, useRef } from 'react'
import { Wand2 } from 'lucide-react'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { ErrorConsole } from '@/components/editor/ErrorConsole'

// Shared YAML code editor (objects and projects): CodeMirror + optional
// prettify + error console, with click-to-line support.
export function YamlEditor({ value, onChange, diagnostics = [], onPrettify = null, onView = null }) {
  const viewRef = useRef(null)

  const scrollToLine = useCallback((line) => {
    const view = viewRef.current
    if (!view || !line) return
    const clamped = Math.min(Math.max(1, line), view.state.doc.lines)
    const info = view.state.doc.line(clamped)
    view.dispatch({ selection: { anchor: info.from }, scrollIntoView: true })
    view.focus()
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {onPrettify ? (
          <button
            type="button"
            onClick={onPrettify}
            title="Reformater le YAML (prettify)"
            aria-label="Reformater le YAML"
            className="absolute top-2 right-12 z-10 flex size-8 items-center justify-center rounded-lg border bg-background/90 text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground"
          >
            <Wand2 className="size-4" />
          </button>
        ) : null}
        <CodeEditor
          value={value}
          onChange={onChange}
          language="yaml"
          onView={(view) => {
            viewRef.current = view
            onView?.(view)
          }}
        />
      </div>
      <ErrorConsole diagnostics={diagnostics} onSelectLine={(item) => scrollToLine(item.line)} />
    </div>
  )
}
