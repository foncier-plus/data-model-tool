import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { GraphView } from '@/components/graph/GraphView'
import { DocumentBreadcrumb } from './DocumentBreadcrumb'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { parseProjectManifest, resolveProjectPatterns } from '@/lib/model/projectManifest'
import { pluralKey, useTranslation } from '@/lib/i18n'

function baseName(path) {
  return path ? path.split('/').pop() : ''
}

function errorMessage(error, t) {
  switch (error.code) {
    case 'notObject':
      return t('project.error.notObject')
    case 'titleRequired':
      return t('project.error.titleRequired')
    case 'includeInvalid':
      return t('project.error.includeInvalid')
    case 'excludeInvalid':
      return t('project.error.excludeInvalid')
    case 'includeNoMatch':
      return t('project.error.includeNoMatch', { pattern: error.pattern })
    case 'excludeNoMatch':
      return t('project.error.excludeNoMatch', { pattern: error.pattern })
    default:
      return error.message ?? error.code
  }
}

export function ProjectDocumentView({ fileName, entries, selection, onSelect }) {
  const { t, language } = useTranslation()
  const readDocument = useProjectStore((state) => state.readDocument)
  const saveDocument = useProjectStore((state) => state.saveDocument)
  const docRevision = useProjectStore((state) => state.docRevision)
  const [text, setText] = useState('')
  const saved = useRef('')
  const ready = useRef(false)

  useEffect(() => {
    let active = true
    readDocument(fileName)
      .then((content) => {
        if (!active) return
        const value = content ?? ''
        saved.current = value
        setText(value)
        ready.current = true
      })
      .catch(() => toast.error(t('project.readError', { file: fileName })))
    return () => {
      active = false
    }
  }, [fileName, readDocument, docRevision, t])

  const save = useCallback(
    async (value) => {
      const ok = await saveDocument(fileName, value)
      if (ok) saved.current = value
      return ok
    },
    [fileName, saveDocument],
  )

  useEffect(() => {
    if (!ready.current || text === saved.current) return undefined
    const timer = setTimeout(() => save(text), 600)
    return () => clearTimeout(timer)
  }, [text, save])

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        save(text)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [save, text])

  const manifest = useMemo(() => parseProjectManifest(fileName, text), [fileName, text])
  const resolved = useMemo(
    () => resolveProjectPatterns(entries, manifest.include, manifest.exclude),
    [entries, manifest],
  )
  const errors = [...manifest.errors, ...resolved.errors]
  const hasObjects = resolved.ids.size > 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DocumentBreadcrumb fileName={fileName} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r">
          <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs">
            <span className="truncate font-semibold">{manifest.title || baseName(fileName)}</span>
            <span className="ml-auto shrink-0 text-muted-foreground">
              {t(pluralKey(language, 'project.objects', resolved.ids.size), {
                count: resolved.ids.size,
              })}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <CodeEditor value={text} onChange={setText} language="yaml" />
          </div>
          {errors.length > 0 ? (
            <div className="max-h-40 shrink-0 overflow-auto border-t bg-destructive/5 px-3 py-2">
              <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-destructive">
                <AlertTriangle className="size-3" />
                {t(pluralKey(language, 'project.problems', errors.length), {
                  count: errors.length,
                })}
              </div>
              <ul className="flex flex-col gap-0.5">
                {errors.map((error, index) => (
                  <li
                    key={`${error.code}-${error.pattern ?? index}`}
                    className="font-mono text-[11px] text-destructive"
                  >
                    {errorMessage(error, t)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="hidden min-w-0 flex-1 overflow-hidden lg:block">
          {hasObjects ? (
            <GraphView
              entries={entries}
              selection={selection}
              onSelect={onSelect}
              scope="project"
              internalObjectIds={resolved.ids}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {t('project.empty')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
