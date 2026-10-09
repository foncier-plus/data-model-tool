import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { AlertCircle, Check, Code, Languages, Loader2, Moon, RefreshCw, Sun, Workflow } from 'lucide-react'
import { ConflictDialog } from '@/components/ConflictDialog'
import { ExplorerPanel } from '@/components/panels/ExplorerPanel'
import { Inspector } from '@/components/panels/Inspector'
import { ProjectForm } from '@/components/panels/ProjectForm'
import { MarkdownOutline } from '@/components/panels/MarkdownOutline'
import { DocumentView } from '@/components/documents/DocumentView'
import { TopBreadcrumb } from '@/components/documents/TopBreadcrumb'
import { SideRail } from '@/components/layout/SideRail'
import {
  flushDocument,
  resetDocumentSessions,
  useActiveDocument,
} from '@/components/documents/useActiveDocument'
import { Button } from '@/components/ui/button'
import { resolveEditorFile, resolveFocus, resolveSidebarKey } from '@/lib/navigation'
import { classifyFile } from '@/lib/fs/documentType'
import { useTranslation } from '@/lib/i18n'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { scopeMarkdownCss } from '@/lib/markdownCss'
import { cn } from '@/lib/utils'

function ThemeToggle({ className }) {
  const { resolvedTheme, setTheme } = useTheme()
  const { t } = useTranslation()
  const dark = resolvedTheme === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      title={dark ? t('theme.light') : t('theme.dark')}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}

function LanguageToggle({ className }) {
  const { language, t } = useTranslation()
  const setLanguage = useProjectStore((state) => state.setLanguage)
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      title={t('language.toggle')}
      onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
    >
      <Languages />
    </Button>
  )
}

function SaveStatus({ className }) {
  const { t } = useTranslation()
  const status = useProjectStore((state) => state.status)
  const message = useProjectStore((state) => state.message)
  if (status !== 'saving' && status !== 'saved' && status !== 'error') return null
  const label =
    status === 'saving'
      ? t('status.saving')
      : status === 'error'
        ? message || t('status.error')
        : t('status.saved')
  const Icon = status === 'saving' ? Loader2 : status === 'error' ? AlertCircle : Check
  return (
    <span
      title={label}
      className={cn(
        'flex items-center gap-1 text-xs',
        status === 'error' ? 'text-red-300' : 'text-slate-300',
        className,
      )}
    >
      <Icon className={cn('size-3.5', status === 'saving' && 'animate-spin')} />
      <span className="hidden max-w-40 truncate sm:inline">{label}</span>
    </span>
  )
}

export default function Workspace() {
  const { t } = useTranslation()
  const entries = useProjectStore((state) => state.entries)
  const activeFile = useProjectStore((state) => state.activeFile)
  const selection = useProjectStore((state) => state.selection)
  const select = useProjectStore((state) => state.select)
  const openFile = useProjectStore((state) => state.openFile)
  const notebookName = useProjectStore((state) => state.notebookName)
  const markdownCss = useProjectStore((state) => state.markdownCss)
  const refresh = useProjectStore((state) => state.refresh)
  const closeNotebook = useProjectStore((state) => state.closeNotebook)
  const editorOpen = useProjectStore((state) => state.editorOpen)
  const toggleEditor = useProjectStore((state) => state.toggleEditor)
  const docTarget = useProjectStore((state) => state.docTarget)

  const [explorerWidth, setExplorerWidth] = useState(280)
  const [panelWidth, setPanelWidth] = useState(380)
  const [explorerCollapsed, setExplorerCollapsed] = useState(false)
  const [panelCollapsed, setPanelCollapsed] = useState(false)

  // Reset document sessions when the notebook changes.
  useEffect(() => {
    resetDocumentSessions()
  }, [notebookName])

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        const state = useProjectStore.getState()
        for (const file of state.files) {
          if (file.dirty) state.flush(file.fileName)
        }
        if (state.activeFile) flushDocument(state.activeFile)
        if (state.docTarget?.fileName) flushDocument(state.docTarget.fileName)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const activeType = activeFile ? classifyFile(activeFile) : null
  const documentEnabled = activeType === 'project' || activeType === 'markdown'
  const activeDocument = useActiveDocument(activeFile, documentEnabled)

  const focus = resolveFocus(selection, docTarget)
  const editorFile = resolveEditorFile({ activeFile, entries, selection, docTarget })
  const editorType = editorFile ? classifyFile(editorFile) : null
  const editorDocument = useActiveDocument(
    editorFile,
    editorType === 'project' || editorType === 'markdown',
  )
  const sidebarKey = resolveSidebarKey(activeType, focus)

  const showSidebar =
    activeType === 'yaml' || activeType === 'project' || activeType === 'markdown'

  const focusFileContext = () => {
    if (activeType === 'yaml') {
      const first = entries.find((entry) => entry.fileName === activeFile)
      if (first) {
        select({
          kind: 'object',
          objectName: first.qualifiedName,
          groupName: null,
          attributeName: null,
          ref: first.qualifiedName,
        })
        return
      }
    }
    select(null)
  }

  const handleGraphSelect = (next) => (next ? select(next) : focusFileContext())

  const startResize = (event, { width, setWidth, min, max, invert }) => {
    event.preventDefault()
    const startX = event.clientX
    const onMove = (moveEvent) => {
      const delta = invert ? startX - moveEvent.clientX : moveEvent.clientX - startX
      setWidth(Math.min(max, Math.max(min, width + delta)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const renderSidebar = () => {
    if (sidebarKey === 'outline') {
      const isDoc = focus?.type === 'document'
      return (
        <MarkdownOutline
          fileName={isDoc ? docTarget.fileName : activeFile}
          text={isDoc ? editorDocument.text : activeDocument.text}
        />
      )
    }
    if (sidebarKey === 'project') {
      return (
        <ProjectForm
          fileName={activeFile}
          text={activeDocument.text}
          onChange={activeDocument.onChange}
        />
      )
    }
    return <Inspector entries={entries} selection={selection} />
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      {markdownCss ? <style>{scopeMarkdownCss(markdownCss)}</style> : null}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 text-slate-100">
        <div className="flex min-w-0 shrink-0 items-center gap-3">
          <button
            type="button"
            title={t('app.changeNotebook')}
            onClick={closeNotebook}
            className="flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left hover:bg-white/10"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Workflow className="size-4" />
            </span>
            <span className="truncate text-sm font-semibold">Data Flow</span>
          </button>

          <div className="flex min-w-0 max-w-40 items-center gap-1 border-l border-white/15 pl-3">
            <span className="truncate text-sm font-medium text-slate-300">
              {notebookName ?? t('app.notebook')}
            </span>
            <button
              type="button"
              title={t('app.refresh')}
              aria-label={t('app.refresh')}
              onClick={refresh}
              className="flex size-6 shrink-0 items-center justify-center rounded text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden px-4">
          {activeFile ? (
            <TopBreadcrumb fileName={activeFile} focus={focus} onSelectFile={focusFileContext} />
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SaveStatus />
          {editorFile && activeType !== 'pdf' && activeType !== 'image' ? (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'text-slate-200 hover:bg-white/10 hover:text-white',
                editorOpen && 'bg-white/20 text-white',
              )}
              title={t(editorOpen ? 'view.hideEditor' : 'view.showEditor')}
              aria-pressed={editorOpen}
              onClick={toggleEditor}
            >
              <Code />
            </Button>
          ) : null}
          <ThemeToggle className="text-slate-200 hover:bg-white/10 hover:text-white" />
          <LanguageToggle className="text-slate-200 hover:bg-white/10 hover:text-white" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {!explorerCollapsed ? <ExplorerPanel width={explorerWidth} /> : null}
        <SideRail
          side="left"
          collapsed={explorerCollapsed}
          onToggle={() => setExplorerCollapsed((value) => !value)}
          onResize={(event) =>
            startResize(event, {
              width: explorerWidth,
              setWidth: setExplorerWidth,
              min: 200,
              max: 520,
              invert: false,
            })
          }
        />

        <main className="h-full min-h-0 min-w-0 flex-1 overflow-hidden">
          <DocumentView
            entries={entries}
            selection={selection}
            onSelect={handleGraphSelect}
            onOpenFile={openFile}
            document={activeDocument}
            editorDocument={editorDocument}
            editorFile={editorFile}
            editorOpen={editorOpen}
            docTarget={docTarget}
          />
        </main>

        {showSidebar ? (
          <>
            <SideRail
              side="right"
              collapsed={panelCollapsed}
              onToggle={() => setPanelCollapsed((value) => !value)}
              onResize={(event) =>
                startResize(event, {
                  width: panelWidth,
                  setWidth: setPanelWidth,
                  min: 240,
                  max: 760,
                  invert: true,
                })
              }
            />

            {!panelCollapsed ? (
              <aside
                style={{ width: panelWidth }}
                className="sidebar-panel flex h-full min-h-0 shrink-0 flex-col overflow-hidden bg-sidebar"
              >
                <div className="min-h-0 flex-1 overflow-hidden">{renderSidebar()}</div>
              </aside>
            ) : null}
          </>
        ) : null}
      </div>

      <ConflictDialog />
    </div>
  )
}
