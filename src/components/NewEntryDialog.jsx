import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProjectStore } from '@/lib/store/useProjectStore'

export function NewEntryDialog({ target, onClose }) {
  const createObject = useProjectStore((state) => state.createObject)
  const createNamespace = useProjectStore((state) => state.createNamespace)
  const [name, setName] = useState('')
  const [lastTarget, setLastTarget] = useState(target)

  const open = Boolean(target)
  const kind = target?.kind ?? 'object'

  if (target !== lastTarget) {
    setLastTarget(target)
    setName('')
  }

  const submit = async () => {
    const value = name.trim()
    if (!value) return
    const full = target?.base ? `${target.base}/${value}` : value
    const created =
      kind === 'namespace' ? await createNamespace(full) : await createObject(full)
    if (created) {
      setName('')
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === 'namespace' ? 'Nouveau namespace' : 'Nouvel objet'}</DialogTitle>
          <DialogDescription>
            {target?.base ? `Dans ${target.base}` : 'À la racine'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Nom</Label>
          <Input
            autoFocus
            value={name}
            placeholder={kind === 'namespace' ? 'sous-namespace' : 'objet'}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
