import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { DocumentBreadcrumb } from './DocumentBreadcrumb'
import { useProjectStore } from '@/lib/store/useProjectStore'

export function ImageDocumentView({ fileName }) {
  const readBlob = useProjectStore((state) => state.readBlob)
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let active = true
    let objectUrl = null
    readBlob(fileName)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {})
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [fileName, readBlob])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DocumentBreadcrumb fileName={fileName} />
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/30 p-6">
        {url ? (
          <img src={url} alt={fileName} className="max-h-full max-w-full rounded-lg object-contain shadow-sm" />
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Chargement de l'image…
          </div>
        )}
      </div>
    </div>
  )
}
