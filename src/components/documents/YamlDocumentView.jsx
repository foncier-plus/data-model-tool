import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Wand2 } from 'lucide-react'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { ErrorConsole } from '@/components/editor/ErrorConsole'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { parseObjectFile } from '@/lib/model/parse'
import { prettifyFile } from '@/lib/model/prettify'
import { yamlDiagnostics } from '@/lib/model/yamlErrors'
import { parseWikiLink, resolveWikiPath } from '@/lib/model/wiki'

function collectPaths(node, paths = new Set()) {
  for (const child of node?.children ?? []) {
    if (child.kind === 'directory') collectPaths(child, paths)
    else paths.add(child.path)
  }
  return paths
}

function aboutTargets(entry) {
  const targets = []
  if (entry.model?.about) targets.push(entry.model.about)
  for (const attribute of entry.model?.attributes ?? []) {
    if (attribute.about) targets.push(attribute.about)
  }
  for (const group of entry.model?.groups ?? []) {
    for (const attribute of group.attributes ?? []) {
      if (attribute.about) targets.push(attribute.about)
    }
  }
  return targets
}

export function YamlDocumentView({ fileName }) {
  const file = useProjectStore((state) => state.files.find((item) => item.fileName === fileName))
  const tree = useProjectStore((state) => state.tree)
  const applySource = useProjectStore((state) => state.applySource)
  const reveal = useProjectStore((state) => state.reveal)
  const [text, setText] = useState(() => file?.content ?? '')
  const lastApplied = useRef(file?.content ?? '')
  const viewRef = useRef(null)
  const [viewReady, setViewReady] = useState(false)

  const filePaths = useMemo(() => collectPaths(tree), [tree])
  const parsed = useMemo(() => parseObjectFile(fileName, text), [fileName, text])

  const apply = useCallback(
    (value) => {
      const result = applySource(fileName, value)
      if (result.ok) lastApplied.current = value
      return result
    },
    [applySource, fileName],
  )

  useEffect(() => {
    if (text === lastApplied.current) return undefined
    const timer = setTimeout(() => apply(text), 600)
    return () => clearTimeout(timer)
  }, [text, apply])

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (apply(text).ok) useProjectStore.getState().flush(fileName)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [apply, text, fileName])

  const diagnostics = useMemo(() => {
    const items = yamlDiagnostics(text).map((item) => ({ ...item, severity: 'error' }))
    for (const entry of parsed.entries) {
      for (const message of entry.errors.slice(entry.doc.errors.length)) {
        items.push({ severity: 'warning', message })
      }
      for (const about of aboutTargets(entry)) {
        const link = parseWikiLink(about)
        if (!link) {
          items.push({ severity: 'warning', message: `Lien wiki invalide : ${about}` })
          continue
        }
        if (!filePaths.has(resolveWikiPath(fileName, link.path))) {
          items.push({ severity: 'warning', message: `Lien cassé : ${about}` })
        }
      }
    }
    return items
  }, [text, parsed, filePaths, fileName])

  const scrollToLine = useCallback((line) => {
    const view = viewRef.current
    if (!view || !line) return
    const clamped = Math.min(Math.max(1, line), view.state.doc.lines)
    const info = view.state.doc.line(clamped)
    view.dispatch({ selection: { anchor: info.from }, scrollIntoView: true })
    view.focus()
  }, [])

  useEffect(() => {
    if (!reveal || reveal.fileName !== fileName) return undefined
    const timer = setTimeout(() => scrollToLine(reveal.line), 0)
    return () => clearTimeout(timer)
  }, [reveal, fileName, viewReady, scrollToLine])

  const jumpTo = (item) => scrollToLine(item.line)

  const prettify = () => {
    const next = prettifyFile(text)
    setText(next)
    if (apply(next).ok) useProjectStore.getState().flush(fileName)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <button
          type="button"
          onClick={prettify}
          title="Reformater le YAML (prettify)"
          aria-label="Reformater le YAML"
          className="absolute top-2 right-12 z-10 flex size-8 items-center justify-center rounded-lg border bg-background/90 text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground"
        >
          <Wand2 className="size-4" />
        </button>
        <CodeEditor
          value={text}
          onChange={setText}
          language="yaml"
          onView={(view) => {
            viewRef.current = view
            setViewReady(true)
          }}
        />
      </div>
      <ErrorConsole diagnostics={diagnostics} onSelectLine={jumpTo} />
    </div>
  )
}
