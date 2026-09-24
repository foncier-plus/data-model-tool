import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { serializeObject } from '@/lib/model/serialize'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { YamlEditor } from './YamlEditor'

export function SourcePanel({ entry, selection }) {
  const applySource = useProjectStore((state) => state.applySource)
  const [text, setText] = useState(() => serializeObject(entry.doc))
  const [lastKey, setLastKey] = useState(entry.fileName)
  const [errors, setErrors] = useState([])

  if (entry.fileName !== lastKey) {
    setLastKey(entry.fileName)
    setText(serializeObject(entry.doc))
    setErrors([])
  }

  const handleApply = () => {
    const result = applySource(entry.fileName, text)
    if (result.ok) {
      setErrors([])
      if (result.content !== undefined) setText(result.content)
    } else {
      setErrors(result.errors)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <span className="truncate text-xs text-zinc-400">{selection?.ref ?? entry.fileName}</span>
        <Button size="sm" variant="ghost" aria-label="Enregistrer" title="Enregistrer" onClick={handleApply}>
          <Save className="size-4" />
        </Button>
      </div>
      <YamlEditor value={text} onChange={setText} />
      {errors.length > 0 ? (
        <div className="flex flex-col gap-0.5 border-t border-zinc-800 px-3 py-2 text-xs text-red-400">
          {errors.map((error, index) => (
            <p key={index}>{error}</p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
