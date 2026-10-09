import { useMemo } from 'react'
import { Boxes } from 'lucide-react'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { classifyFile } from '@/lib/fs/documentType'
import { useTranslation } from '@/lib/i18n'
import { GraphView } from '@/components/graph/GraphView'
import { DocumentBreadcrumb } from './DocumentBreadcrumb'
import { YamlDocumentView } from './YamlDocumentView'
import { ProjectEditor } from './ProjectEditor'
import { MarkdownEditor, MarkdownPreview } from './MarkdownDocumentView'
import { PdfDocumentView } from './PdfDocumentView'
import { ImageDocumentView } from './ImageDocumentView'
import { parseProjectManifest, resolveProjectPatterns } from '@/lib/model/projectManifest'
import { headingPathAtLine } from '@/lib/model/wiki'

function EmptyState() {
  const { t } = useTranslation()
  const projects = useProjectStore((state) => state.projects)
  const openFile = useProjectStore((state) => state.openFile)

  if (projects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
        {t('document.open')}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-auto p-6">
      <div className="flex flex-wrap justify-center gap-3">
        {projects.map(({ path, name }) => (
          <button
            key={path}
            type="button"
            title={path}
            onClick={() => openFile(path)}
            className="flex w-36 flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:bg-accent"
          >
            <Boxes className="size-8 text-orange-400" />
            <span className="line-clamp-2 w-full text-sm font-medium break-words">{name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function DocumentView({
  entries = [],
  selection,
  onSelect,
  onOpenFile,
  document,
  editorDocument,
  editorFile,
  editorOpen,
  docTarget,
}) {
  const { t } = useTranslation()
  const activeFile = useProjectStore((state) => state.activeFile)
  const setDocTargetHeadings = useProjectStore((state) => state.setDocTargetHeadings)

  const type = activeFile ? classifyFile(activeFile) : null
  const documentText = document?.text ?? ''
  const manifest = useMemo(
    () => (type === 'project' ? parseProjectManifest(activeFile, documentText) : null),
    [type, activeFile, documentText],
  )
  const resolved = useMemo(
    () => (manifest ? resolveProjectPatterns(entries, manifest.include, manifest.exclude) : null),
    [manifest, entries],
  )

  if (!activeFile) {
    return <EmptyState />
  }

  if (type === 'pdf' || type === 'image') {
    return (
      <div className="relative h-full min-h-0">
        {type === 'pdf' ? (
          <PdfDocumentView fileName={activeFile} />
        ) : (
          <ImageDocumentView fileName={activeFile} />
        )}
      </div>
    )
  }

  // The editor targets the documentation/selection file, else the main file.
  const editorType = classifyFile(editorFile ?? activeFile)
  const editorText = editorDocument?.text ?? ''
  let editor = null
  if (editorType === 'yaml') {
    editor = <YamlDocumentView fileName={editorFile ?? activeFile} />
  } else if (editorType === 'project') {
    editor = (
      <ProjectEditor
        fileName={editorFile}
        text={editorText}
        onChange={editorDocument?.onChange}
        entries={entries}
      />
    )
  } else if (editorType === 'markdown') {
    editor = (
      <MarkdownEditor
        fileName={editorFile ?? activeFile}
        text={editorText}
        onChange={editorDocument?.onChange}
        onCursor={
          docTarget
            ? (line) => setDocTargetHeadings(headingPathAtLine(editorText, line))
            : null
        }
      />
    )
  }

  // The central view follows the documentation target when there is one.
  let view = null
  if (docTarget) {
    view = <MarkdownPreview fileName={docTarget.fileName} text={editorText} />
  } else if (type === 'yaml') {
    view = (
      <GraphView
        entries={entries}
        selection={selection}
        onSelect={onSelect}
        scope="file"
        fileName={activeFile}
      />
    )
  } else if (type === 'project') {
    view =
      resolved && resolved.ids.size > 0 ? (
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
      )
  } else if (type === 'markdown') {
    view = <MarkdownPreview fileName={activeFile} text={documentText} />
  }

  return (
    <div className="relative flex h-full min-h-0">
      {editorOpen && editor ? (
        <div className="flex min-w-0 flex-1 flex-col border-r">
          <DocumentBreadcrumb
            fileName={editorFile ?? activeFile}
            onSelect={() => onOpenFile?.(editorFile ?? activeFile)}
          />
          <div className="min-h-0 flex-1">{editor}</div>
        </div>
      ) : null}
      <div className="min-w-0 flex-1 overflow-hidden">{view}</div>
    </div>
  )
}
