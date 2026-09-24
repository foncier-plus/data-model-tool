import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Code,
  Info,
  List,
  PanelRightClose,
  PanelRightOpen,
  Sigma,
  Workflow,
} from 'lucide-react'
import { AttributesPanel } from '@/components/panels/AttributesPanel'
import { Breadcrumb } from '@/components/panels/Breadcrumb'
import { ConflictDialog } from '@/components/ConflictDialog'
import { ExplorerPanel } from '@/components/panels/ExplorerPanel'
import { GraphView } from '@/components/graph/GraphView'
import { FormulaPanel } from '@/components/panels/FormulaPanel'
import { Inspector } from '@/components/panels/Inspector'
import { SourcePanel } from '@/components/panels/SourcePanel'
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
import { resolveSelection } from '@/lib/selection'
import { useProjectStore } from '@/lib/store/useProjectStore'

function projectOfFile(fileName) {
  if (!fileName) return null
  const slash = fileName.indexOf('/')
  return slash === -1 ? null : fileName.slice(0, slash)
}

function IssuesDialog({ issues, project, onSelectIssue }) {
  const [open, setOpen] = useState(false)
  const visible = project ? issues.filter((issue) => projectOfFile(issue.file) === project) : issues

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={visible.length === 0}>
          <AlertTriangle />
          {visible.length} issue{visible.length > 1 ? 's' : ''}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{project ? `Issues · ${project}` : 'Model issues'}</DialogTitle>
          <DialogDescription>
            Unresolved references, duplicates, self references and cycles.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-1 overflow-auto">
          {visible.map((issue, index) => (
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

export default function Workspace() {
  const entries = useProjectStore((state) => state.entries)
  const namespaces = useProjectStore((state) => state.namespaces)
  const selection = useProjectStore((state) => state.selection)
  const panelTab = useProjectStore((state) => state.panelTab)
  const setPanelTab = useProjectStore((state) => state.setPanelTab)
  const refresh = useProjectStore((state) => state.refresh)
  const select = useProjectStore((state) => state.select)

  const [explorerWidth, setExplorerWidth] = useState(256)
  const [panelWidth, setPanelWidth] = useState(380)
  const [collapsed, setCollapsed] = useState(false)
  const [selectedObjects, setSelectedObjects] = useState(() => new Set())

  useEffect(() => {
    refresh()
  }, [refresh])

  const index = useMemo(() => buildIndex(entries), [entries])
  const issues = useMemo(() => validateReferences(entries), [entries])
  const resolved = useMemo(() => resolveSelection(entries, selection), [entries, selection])

  const selectionKind = selection?.kind ?? null
  const showAttributes = selectionKind === 'object' || selectionKind === 'group'
  const showSource = selectionKind === 'object'

  const selectedProject = useMemo(() => {
    for (const id of selectedObjects) {
      const entry = entries.find((item) => item.qualifiedName === id)
      if (entry?.namespace) return entry.namespace.split('.')[0]
    }
    return null
  }, [selectedObjects, entries])

  useEffect(() => {
    document.title = selectedProject ? `${selectedProject} · Data Flow` : 'Data Flow'
  }, [selectedProject])

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
    <div className="flex h-svh flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-blue-600 text-white">
            <Workflow className="size-4" />
          </span>
          <span className="text-sm font-semibold">Data Flow</span>
          {selectedProject ? (
            <span data-project-title={selectedProject} className="text-lg font-bold">
              {selectedProject}
            </span>
          ) : null}
        </div>
        <div className="flex-1" />
        {selectedProject ? (
          <IssuesDialog issues={issues} project={selectedProject} onSelectIssue={handleSelectIssue} />
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          title={collapsed ? 'Show panel' : 'Hide panel'}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <PanelRightOpen /> : <PanelRightClose />}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ExplorerPanel
          entries={entries}
          namespaces={namespaces}
          selectedObjects={selectedObjects}
          onChange={setSelectedObjects}
          onRefresh={refresh}
          width={explorerWidth}
        />
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(event) =>
            startResize(event, {
              width: explorerWidth,
              setWidth: setExplorerWidth,
              min: 180,
              max: 520,
              invert: false,
            })
          }
          className="group flex w-1.5 shrink-0 cursor-col-resize items-center justify-center"
        >
          <span className="h-full w-px bg-border transition-all group-hover:w-0.5 group-hover:bg-primary" />
        </div>
        <main className="h-full min-h-0 flex-1 overflow-hidden">
          <GraphView
            entries={entries}
            selection={selection}
            onSelect={select}
            selectedObjects={selectedObjects}
          />
        </main>

        {collapsed ? null : (
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
        )}

        <aside
          style={collapsed ? undefined : { width: panelWidth }}
          className={`h-full min-h-0 flex-col overflow-hidden ${
            collapsed ? 'hidden' : 'flex shrink-0'
          }`}
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
                  About
                </TabsTrigger>
                {showAttributes ? (
                  <TabsTrigger value="attributes" className="flex-1 text-xs">
                    <List className="size-3.5" />
                    Attributes
                  </TabsTrigger>
                ) : null}
                {showAttributes ? (
                  <TabsTrigger value="formula" className="flex-1 text-xs">
                    <Sigma className="size-3.5" />
                    Formulas
                  </TabsTrigger>
                ) : null}
                {showSource ? (
                  <TabsTrigger value="source" className="flex-1 text-xs">
                    <Code className="size-3.5" />
                    Source
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
            <TabsContent value="source" className="m-0 min-h-0 flex-1">
              {resolved ? (
                <SourcePanel entry={resolved.entry} selection={selection} />
              ) : (
                <p className="p-4 text-sm text-muted-foreground">
                  Select an object to edit its YAML source.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      <ConflictDialog />
    </div>
  )
}
