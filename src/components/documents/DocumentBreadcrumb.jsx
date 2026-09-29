import { Fragment, useState } from 'react'
import { ChevronRight, Folder } from 'lucide-react'
import { classifyFile } from '@/lib/fs/documentType'
import { fileVisual, FOLDER_TEXT } from '@/components/files/visuals'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { cn } from '@/lib/utils'

function stripExtension(name) {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? name : name.slice(0, dot)
}

function extensionOf(name) {
  const base = stripExtension(name)
  return name.slice(base.length)
}

export function DocumentBreadcrumb({ fileName, children }) {
  const renamePath = useProjectStore((state) => state.renamePath)
  const segments = fileName.split('/')
  const folders = segments.slice(0, -1)
  const file = segments.at(-1)
  const { Icon, text } = fileVisual(classifyFile(file))
  const base = stripExtension(file)
  const extension = extensionOf(file)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(base)

  const commitRename = async () => {
    const value = draft.trim()
    setRenaming(false)
    if (!value || value === base) return
    const ok = await renamePath(fileName, `${value}${extension}`)
    if (!ok) setDraft(base)
  }

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b bg-card px-3 text-xs">
      {folders.map((folder, index) => (
        <Fragment key={`${folder}-${index}`}>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Folder className={cn('size-3.5 shrink-0', FOLDER_TEXT)} />
            <span className="max-w-40 truncate">{folder}</span>
          </span>
          <ChevronRight className="size-3 shrink-0 text-muted-foreground/50" />
        </Fragment>
      ))}

      <span className="flex min-w-0 items-center gap-1">
        <Icon className={cn('size-3.5 shrink-0', text)} />
        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename()
              if (event.key === 'Escape') setRenaming(false)
            }}
            className="min-w-0 rounded border border-primary/40 bg-white px-1 py-0.5 text-xs text-foreground outline-none dark:bg-zinc-900"
          />
        ) : (
          <button
            type="button"
            title="Double-cliquez pour renommer"
            onDoubleClick={() => {
              setDraft(base)
              setRenaming(true)
            }}
            className="max-w-64 truncate font-medium text-foreground"
          >
            {base}
          </button>
        )}
      </span>

      <div className="flex-1" />
      {children ? <div className="flex shrink-0 items-center gap-1">{children}</div> : null}
    </div>
  )
}
