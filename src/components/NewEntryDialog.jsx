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

const KINDS = [
  { value: 'object', label: 'Objet YAML', placeholder: 'mon_objet' },
  { value: 'markdown', label: 'Document Markdown', placeholder: 'guide' },
  { value: 'folder', label: 'Répertoire', placeholder: 'sous-dossier' },
]

export function NewEntryDialog({ target, onClose }) {
  const createObject = useProjectStore((state) => state.createObject)
  const createDocument = useProjectStore((state) => state.createDocument)
  const createFolder = useProjectStore((state) => state.createFolder)

  const [kind, setKind] = useState('object')
  const [name, setName] = useState('')
  const [namespace, setNamespace] = useState('')
  const [lastTarget, setLastTarget] = useState(target)

  const open = Boolean(target)

  if (target !== lastTarget) {
    setLastTarget(target)
    setName('')
    setNamespace('')
    setKind(target?.kind ?? 'object')
  }

  const submit = async () => {
    const value = name.trim()
    if (!value) return
    const dir = target?.dirPath ?? ''
    if (kind === 'object') await createObject(dir, value, namespace.trim())
    else if (kind === 'markdown') await createDocument(dir, value, 'markdown')
    else await createFolder(dir, value)
    onClose()
  }

  const placeholder = KINDS.find((item) => item.value === kind)?.placeholder

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau</DialogTitle>
          <DialogDescription>{target?.dirPath ? `Dans ${target.dirPath}` : 'À la racine'}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <div className="flex gap-1 rounded-md border p-1">
            {KINDS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setKind(item.value)}
                className={`flex-1 rounded px-2 py-1 text-xs ${
                  kind === item.value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Label className="text-xs text-muted-foreground">Nom</Label>
          <Input
            autoFocus
            value={name}
            placeholder={placeholder}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
          />

          {kind === 'object' ? (
            <>
              <Label className="text-xs text-muted-foreground">Namespace (optionnel)</Label>
              <Input
                value={namespace}
                placeholder="sales.crm"
                onChange={(event) => setNamespace(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submit()
                }}
              />
            </>
          ) : null}
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
