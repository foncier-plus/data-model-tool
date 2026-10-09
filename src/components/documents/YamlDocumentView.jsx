import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SourceEditor } from '@/components/editor/SourceEditor'
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
  const storedContent = file?.content ?? ''
  const [text, setText] = useState(() => storedContent)
  const lastApplied = useRef(storedContent)

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

  // Keep the editor in sync when the file content is updated elsewhere
  // (e.g. an object/group/attribute property edited from the side panel).
  useEffect(() => {
    if (storedContent === lastApplied.current) return
    lastApplied.current = storedContent
    setText(storedContent)
  }, [storedContent])

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

  const prettify = () => {
    const next = prettifyFile(text)
    setText(next)
    if (apply(next).ok) useProjectStore.getState().flush(fileName)
  }

  return (
    <SourceEditor
      language="yaml"
      fileName={fileName}
      value={text}
      onChange={setText}
      diagnostics={diagnostics}
      onPrettify={prettify}
    />
  )
}
