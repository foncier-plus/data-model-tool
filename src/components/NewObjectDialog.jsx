import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProjectStore } from '@/lib/store/useProjectStore'

export function NewObjectDialog({ trigger }) {
  const createObject = useProjectStore((state) => state.createObject)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const created = await createObject(trimmed)
    if (created) {
      setName('')
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New object</DialogTitle>
          <DialogDescription>
            Creates <code>objects/&lt;name&gt;.yaml</code> on disk.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input
            autoFocus
            value={name}
            placeholder="sales/invoice"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
          />
          <p className="text-xs text-muted-foreground">
            Use <code>namespace/name</code> to place the object in a namespace. Letters, digits,
            dot, dash and underscore only.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
