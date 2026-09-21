import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useProjectStore } from '@/lib/store/useProjectStore'

export function ConflictDialog() {
  const conflict = useProjectStore((state) => state.conflict)
  const reload = useProjectStore((state) => state.resolveConflictReload)
  const overwrite = useProjectStore((state) => state.resolveConflictOverwrite)
  const dismiss = useProjectStore((state) => state.dismissConflict)

  return (
    <Dialog open={Boolean(conflict)} onOpenChange={(open) => (!open ? dismiss() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>File changed on disk</DialogTitle>
          <DialogDescription>
            <code>{conflict?.fileName}</code> was modified outside the app while you were
            editing. Reload the file to keep the disk version, or overwrite it with your
            in-app changes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={dismiss}>
            Keep editing
          </Button>
          <Button variant="outline" onClick={overwrite}>
            Overwrite
          </Button>
          <Button onClick={reload}>Reload from disk</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
