import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Code,
  Info,
  List,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Sigma,
  Workflow,
} from 'lucide-react'
import { AttributesPanel } from '@/components/panels/AttributesPanel'
import { Breadcrumb } from '@/components/panels/Breadcrumb'
import { ConflictDialog } from '@/components/ConflictDialog'
import { ExplorerPanel } from '@/components/panels/ExplorerPanel'
import { GraphView } from '@/components/graph/GraphView'
import { NewObjectDialog } from '@/components/NewObjectDialog'
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
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { buildIndex, validateReferences } from '@/lib/model/refs'
import { resolveSelection } from '@/lib/selection'
import { useProjectStore } from '@/lib/store/useProjectStore'

function StatusBadge({ status, message }) {
  if (status === 'loading') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Loading…
      </span>
    )
  }
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-destructive">
        <AlertTriangle className="size-3.5" /> {message ?? 'Error'}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <CheckCircle2 className="size-3.5 text-emerald-500" /> Saved to disk
    </span>
  )
}

function IssuesDialog({ issues }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={issues.length === 0}>
          <AlertTriangle />
          {issues.length} issue{issues.length > 1 ? 's' : ''}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Model issues</DialogTitle>
          <DialogDescription>
            Unresolved references, duplicates, self references and cycles.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-1 overflow-auto">
          {issues.map((issue, index) => (
            <div key={index} className="flex items-start gap-2 rounded border p-2 text-xs">
              <code className="shrink-0 rounded bg-muted px-1">{issue.code}</code>
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function Workspace() {
  const entries = useProjectStore((state) => state.entries)
  const selection = useProjectStore((state) => state.selection)
  const status = useProjectStore((state) => state.status)
  const message = useProjectStore((state) => state.message)
  const panelTab = useProjectStore((state) => state.panelTab)
  const setPanelTab = useProjectStore((state) => state.setPanelTab)
  const refresh = useProjectStore((state) => state.refresh)
  const select = useProjectStore((state) => state.select)

  const [panelWidth, setPanelWidth] = useState(380)
  const [collapsed, setCollapsed] = useState(false)
  const [selectedObjects, setSelectedObjects] = useState(() => new Set())

  useEffect(() => {
    refresh()
  }, [refresh])

  const index = useMemo(() => buildIndex(entries), [entries])
  const issues = useMemo(() => validateReferences(entries), [entries])
  const resolved = useMemo(() => resolveSelection(entries, selection), [entries, selection])

  const startResize = (event) => {
    event.preventDefault()
    const start = { x: event.clientX, width: panelWidth }
    const onMove = (moveEvent) => {
      const next = Math.min(760, Math.max(260, start.width + (start.x - moveEvent.clientX)))
      setPanelWidth(next)
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
        </div>
        <Separator orientation="vertical" className="h-5" />
        <StatusBadge status={status} message={message} />
        <div className="flex-1" />
        <IssuesDialog issues={issues} />
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw />
          Refresh
        </Button>
        <NewObjectDialog
          trigger={
            <Button size="sm">
              <Plus />
              New object
            </Button>
          }
        />
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
          selectedObjects={selectedObjects}
          onChange={setSelectedObjects}
        />
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
            onMouseDown={startResize}
            className="w-1.5 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary"
          />
        )}

        <aside
          style={collapsed ? undefined : { width: panelWidth }}
          className={`h-full min-h-0 flex-col overflow-hidden border-l ${
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
                <TabsTrigger value="attributes" className="flex-1 text-xs">
                  <List className="size-3.5" />
                  Attributes
                </TabsTrigger>
                <TabsTrigger value="formula" className="flex-1 text-xs">
                  <Sigma className="size-3.5" />
                  Formulas
                </TabsTrigger>
                <TabsTrigger value="source" className="flex-1 text-xs">
                  <Code className="size-3.5" />
                  Source
                </TabsTrigger>
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
