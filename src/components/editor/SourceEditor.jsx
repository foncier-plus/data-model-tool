import { useCallback, useEffect, useRef, useState } from 'react'
import { Wand2 } from 'lucide-react'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { ErrorConsole } from '@/components/editor/ErrorConsole'
import { useProjectStore } from '@/lib/store/useProjectStore'

// Unified source editor (YAML objects, projects and Markdown): CodeMirror +
// optional prettify + error console, with reveal (scroll to a line) and cursor
// reporting.
export function SourceEditor({
  language = 'yaml',
  fileName = null,
  value,
  onChange,
  diagnostics = null,
  onPrettify = null,
  onCursor = null,
}) {
  const reveal = useProjectStore((state) => state.reveal)
  const viewRef = useRef(null)
  const [ready, setReady] = useState(false)

  const scrollToLine = useCallback((line) => {
    const view = viewRef.current
    if (!view || !line) return
    const clamped = Math.min(Math.max(1, line), view.state.doc.lines)
    const info = view.state.doc.line(clamped)
    view.dispatch({ selection: { anchor: info.from }, scrollIntoView: true })
    view.focus()
  }, [])

  useEffect(() => {
    if (!reveal || !fileName || reveal.fileName !== fileName) return undefined
    const timer = setTimeout(() => scrollToLine(reveal.line), 0)
    return () => clearTimeout(timer)
  }, [reveal, fileName, ready, scrollToLine])

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
          language={language}
          onCursor={onCursor}
          onView={(view) => {
            viewRef.current = view
            setReady(true)
          }}
        />
      </div>
      {diagnostics ? (
        <ErrorConsole diagnostics={diagnostics} onSelectLine={(item) => scrollToLine(item.line)} />
      ) : null}
    </div>
  )
}
