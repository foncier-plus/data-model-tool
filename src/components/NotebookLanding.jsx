import { useState } from 'react'
import { toast } from 'sonner'
import { FileWarning, FolderOpen, FolderSearch, Loader2, Upload, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { handlesFromDataTransfer, isSupported, pickNotebook } from '@/lib/fs/picker'

export function NotebookLanding() {
  const openNotebook = useProjectStore((state) => state.openNotebook)
  const pendingHandle = useProjectStore((state) => state.pendingHandle)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const supported = isSupported()

  const open = async (handle) => {
    if (!handle) return
    setBusy(true)
    try {
      await openNotebook(handle)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  const pick = async () => {
    if (!supported) return
    try {
      await open(await pickNotebook())
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error(error.message)
    }
  }

  const onDrop = async (event) => {
    event.preventDefault()
    setDragging(false)
    const handles = await handlesFromDataTransfer(event.dataTransfer)
    const directory = handles.find((handle) => handle.kind === 'directory')
    if (!directory) {
      toast.error('Déposez un répertoire de notebook.')
      return
    }
    await open(directory)
  }

  return (
    <div className="flex h-svh items-center justify-center bg-muted/30 p-6">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex w-full max-w-xl flex-col items-center gap-6 rounded-2xl border-2 border-dashed bg-background p-10 text-center shadow-sm transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-border'
        }`}
      >
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Workflow className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Data Flow</h1>
          <p className="text-sm text-muted-foreground">
            Ouvrez un notebook : un répertoire contenant des fichiers YAML, Markdown et PDF.
          </p>
        </div>

        {supported ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={pick} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <FolderOpen />}
                Ouvrir un notebook
              </Button>
              {pendingHandle ? (
                <Button variant="outline" onClick={() => open(pendingHandle)} disabled={busy}>
                  <FolderSearch />
                  Reprendre « {pendingHandle.name} »
                </Button>
              ) : null}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Upload className="size-3.5" />
              ou glissez-déposez un répertoire ici
            </p>
          </div>
        ) : (
          <div className="flex max-w-md flex-col items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <FileWarning className="size-5" />
            <p className="font-medium">Navigateur non compatible</p>
            <p>
              Cette application nécessite l'API File System Access, disponible uniquement
              sur les navigateurs Chromium (Chrome, Edge, Brave…).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
