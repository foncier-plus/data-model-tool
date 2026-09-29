import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  AlertTriangle,
  BookText,
  Info,
  List,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Sigma,
  Sun,
  Workflow,
} from 'lucide-react'
import { AttributesPanel } from '@/components/panels/AttributesPanel'
import { Breadcrumb } from '@/components/panels/Breadcrumb'
import { ConflictDialog } from '@/components/ConflictDialog'
import { ExplorerPanel } from '@/components/panels/ExplorerPanel'
import { GraphView } from '@/components/graph/GraphView'
import { FormulaPanel } from '@/components/panels/FormulaPanel'
import { Inspector } from '@/components/panels/Inspector'
import { DocumentView } from '@/components/documents/DocumentView'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { buildIndex, resolveRef, validateReferences } from '@/lib/model/refs'
import { classifyFile } from '@/lib/fs/documentType'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { scopeMarkdownCss } from '@/lib/markdownCss'
import { cn } from '@/lib/utils'

const VIEWS = [
  { value: 'documentation', label: 'Documentation', icon: BookText },
  { value: 'data-model', label: 'Data model', icon: Workflow },
]

function IssuesDialog({ issues, onSelectIssue, className }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={issues.length === 0} className={className}>
          <AlertTriangle />
          {issues.length} problème{issues.length > 1 ? 's' : ''}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Problèmes du modèle</DialogTitle>
          <DialogDescription>
            Références non résolues, doublons, auto-références et cycles.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-1 overflow-auto">
          {issues.map((issue, index) => (
            <button
              key={`${issue.code}-${issue.ref}-${index}`}
              type="button"
              onClick={() => {
                onSelectIssue(issue)
                setOpen(false)
              }}
              className="flex items-start gap-2 rounded border p-2 text-left text-xs hover:bg-accent"
            >
              <code className="shrink-0 rounded bg-muted px-1">{issue.code}</code>
              <span>{issue.message}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ThemeToggle({ className }) {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      title={dark ? 'Thème clair' : 'Thème sombre'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}

export default function Workspace() {
  const entries = useProjectStore((state) => state.entries)
  const activeFile = useProjectStore((state) => state.activeFile)
  const activeView = useProjectStore((state) => state.activeView)
  const setActiveView = useProjectStore((state) => state.setActiveView)
  const selection = useProjectStore((state) => state.selection)
  const panelTab = useProjectStore((state) => state.panelTab)
  const setPanelTab = useProjectStore((state) => state.setPanelTab)
  const select = useProjectStore((state) => state.select)
  const notebookName = useProjectStore((state) => state.notebookName)
  const markdownCss = useProjectStore((state) => state.markdownCss)
  const closeNotebook = useProjectStore((state) => state.closeNotebook)

  const [explorerWidth, setExplorerWidth] = useState(280)
  const [panelWidth, setPanelWidth] = useState(380)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        const state = useProjectStore.getState()
        for (const file of state.files) {
          if (file.dirty) state.flush(file.fileName)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const index = useMemo(() => buildIndex(entries), [entries])
  const issues = useMemo(() => validateReferences(entries), [entries])

  const selectionKind = selection?.kind ?? null
  const showAttributes = selectionKind === 'object' || selectionKind === 'group'
  const activeIsYaml = activeFile ? classifyFile(activeFile) === 'yaml' : false
  const showInspector =
    activeView === 'data-model' || (activeView === 'documentation' && activeIsYaml)

  const handleSelectIssue = (issue) => {
    const element = resolveRef(issue.ref, index)
    if (!element) return
    select({
      kind: element.kind,
      objectName: element.objectName,
      groupName: element.groupName ?? null,
      attributeName: element.attributeName ?? null,
      ref: element.ref,
    })
  }

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

  return (
    <div className="flex h-svh flex-col bg-background">
      {markdownCss ? <style>{scopeMarkdownCss(markdownCss)}</style> : null}
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-4 border-b border-slate-800 bg-slate-900 px-4 text-slate-100">
        <button
          type="button"
          title="Changer de notebook"
          onClick={closeNotebook}
          className="flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left hover:bg-white/10"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Workflow className="size-4" />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">Data Flow</div>
            <div className="truncate text-xs text-slate-400">{notebookName ?? 'Notebook'}</div>
          </div>
        </button>

        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
          <div className="pointer-events-auto inline-flex rounded-full bg-white p-1 shadow-sm">
            {VIEWS.map((view) => {
              const Icon = view.icon
              const isActive = activeView === view.value
              return (
                <button
                  key={view.value}
                  type="button"
                  onClick={() => setActiveView(view.value)}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  <Icon className="size-4" />
                  {view.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <IssuesDialog
            issues={issues}
            onSelectIssue={handleSelectIssue}
            className="border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
          />
          <ThemeToggle className="text-slate-200 hover:bg-white/10 hover:text-white" />
          {showInspector ? (
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-200 hover:bg-white/10 hover:text-white"
              title={collapsed ? "Afficher l'inspecteur" : "Masquer l'inspecteur"}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? <PanelRightOpen /> : <PanelRightClose />}
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ExplorerPanel width={explorerWidth} />
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(event) =>
            startResize(event, {
              width: explorerWidth,
              setWidth: setExplorerWidth,
              min: 200,
              max: 520,
              invert: false,
            })
          }
          className="group flex w-1.5 shrink-0 cursor-col-resize items-center justify-center"
        >
          <span className="h-full w-px bg-border transition-all group-hover:w-0.5 group-hover:bg-primary" />
        </div>

        <main className="h-full min-h-0 flex-1 overflow-hidden">
          {activeView === 'documentation' ? (
            <DocumentView entries={entries} selection={selection} onSelect={select} />
          ) : null}
          {activeView === 'data-model' ? (
            <GraphView entries={entries} selection={selection} onSelect={select} selectedObjects={null} />
          ) : null}
        </main>

        {showInspector && !collapsed ? (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              onMouseDown={(event) =>
                startResize(event, {
                  width: panelWidth,
                  setWidth: setPanelWidth,
                  min: 260,
                  max: 760,
                  invert: true,
                })
              }
              className="group flex w-1.5 shrink-0 cursor-col-resize items-center justify-center"
            >
              <span className="h-full w-px bg-border transition-all group-hover:w-0.5 group-hover:bg-primary" />
            </div>

            <aside
              style={{ width: panelWidth }}
              className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l bg-sidebar"
            >
              <Breadcrumb selection={selection} />
              <Tabs
                value={panelTab}
                onValueChange={setPanelTab}
                className="min-h-0 flex-1 flex-col gap-0"
              >
                <div className="border-b bg-muted/50 px-3 py-2">
                  <TabsList className="w-full">
                    <TabsTrigger value="edit" className="flex-1 text-xs">
                      <Info className="size-3.5" />
                      Fiche
                    </TabsTrigger>
                    {showAttributes ? (
                      <TabsTrigger value="attributes" className="flex-1 text-xs">
                        <List className="size-3.5" />
                        Attributs
                      </TabsTrigger>
                    ) : null}
                    {showAttributes ? (
                      <TabsTrigger value="formula" className="flex-1 text-xs">
                        <Sigma className="size-3.5" />
                        Formules
                      </TabsTrigger>
                    ) : null}
                  </TabsList>
                </div>
                <TabsContent value="edit" className="m-0 min-h-0 flex-1">
                  <Inspector entries={entries} selection={selection} />
                </TabsContent>
                <TabsContent value="attributes" className="m-0 min-h-0 flex-1">
                  <AttributesPanel entries={entries} selection={selection} />
                </TabsContent>
                <TabsContent value="formula" className="m-0 min-h-0 flex-1">
                  <FormulaPanel entries={entries} selection={selection} index={index} />
                </TabsContent>
              </Tabs>
            </aside>
          </>
        ) : null}
      </div>

      <ConflictDialog />
    </div>
  )
}
