import { useMemo } from 'react'
import { FolderOpen, PanelLeft, PanelRight } from 'lucide-react'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { classifyFile } from '@/lib/fs/documentType'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { GraphView } from '@/components/graph/GraphView'
import { DocumentBreadcrumb } from './DocumentBreadcrumb'
import { YamlDocumentView } from './YamlDocumentView'
import { ProjectEditor } from './ProjectEditor'
import { MarkdownEditor, MarkdownPreview } from './MarkdownDocumentView'
import { PdfDocumentView } from './PdfDocumentView'
import { ImageDocumentView } from './ImageDocumentView'
import { parseProjectManifest, resolveProjectPatterns } from '@/lib/model/projectManifest'
import { headingPathAtLine } from '@/lib/model/wiki'

function SideToggle({ side, collapsed, onToggle }) {
  const { t } = useTranslation()
  if (!onToggle) return null
  const isLeft = side === 'left'
  const Icon = isLeft ? PanelLeft : PanelRight
  const label = isLeft
    ? t(collapsed ? 'view.showExplorer' : 'view.hideExplorer')
    : t(collapsed ? 'panel.show' : 'panel.hide')
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={!collapsed}
      onClick={onToggle}
      className={cn(
        'absolute top-1/2 z-20 flex h-12 w-5 -translate-y-1/2 items-center justify-center bg-sidebar text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground',
        isLeft ? 'left-0 rounded-r-lg' : 'right-0 rounded-l-lg',
      )}
    >
      <Icon className="size-3.5" />
    </button>
  )
}

function collectProjects(node, out = []) {
  for (const child of node?.children ?? []) {
    if (child.kind === 'directory') collectProjects(child, out)
    else if (child.type === 'project') out.push(child.path)
  }
  return out
}

function EmptyState({ explorerCollapsed, onToggleExplorer }) {
  const { t } = useTranslation()
  const tree = useProjectStore((state) => state.tree)
  const openFile = useProjectStore((state) => state.openFile)
  const projects = useMemo(() => collectProjects(tree), [tree])

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <SideToggle side="left" collapsed={explorerCollapsed} onToggle={onToggleExplorer} />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <FolderOpen className="size-5" />
          <p>{t('launcher.title')}</p>
        </div>
        {projects.length > 0 ? (
          <div className="flex max-h-[60%] w-full max-w-md flex-col gap-1 overflow-auto">
            {projects.map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => openFile(path)}
                className="truncate rounded-md border bg-card px-3 py-2 text-left font-mono text-xs hover:bg-accent"
              >
                {path}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t('document.open')}</p>
        )}
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
  explorerCollapsed,
  onToggleExplorer,
  panelCollapsed,
  onTogglePanel,
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
    return <EmptyState explorerCollapsed={explorerCollapsed} onToggleExplorer={onToggleExplorer} />
  }

  if (type === 'pdf' || type === 'image') {
    return (
      <div className="relative h-full min-h-0">
        <SideToggle side="left" collapsed={explorerCollapsed} onToggle={onToggleExplorer} />
        <SideToggle side="right" collapsed={panelCollapsed} onToggle={onTogglePanel} />
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
      <SideToggle side="left" collapsed={explorerCollapsed} onToggle={onToggleExplorer} />
      <SideToggle side="right" collapsed={panelCollapsed} onToggle={onTogglePanel} />
    </div>
  )
}
