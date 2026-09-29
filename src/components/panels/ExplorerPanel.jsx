import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  FileText,
  Folder,
  FolderOpen,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { NewEntryDialog } from '@/components/NewEntryDialog'
import { fileVisual, FOLDER_TEXT } from '@/components/files/visuals'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { handlesFromDataTransfer } from '@/lib/fs/picker'
import { cn } from '@/lib/utils'

function stripExtension(name) {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? name : name.slice(0, dot)
}

function extensionOf(name) {
  const base = stripExtension(name)
  return name.slice(base.length)
}

let dragSource = null

function Menu({ menu, items, onClose }) {
  useEffect(() => {
    if (!menu) return undefined
    const close = () => onClose()
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [menu, onClose])

  if (!menu) return null

  return (
    <div
      className="fixed z-50 min-w-44 overflow-hidden rounded-lg border bg-popover py-1 text-xs shadow-lg"
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
    >
      {items.map((item, index) =>
        item.separator ? (
          <div key={`sep-${index}`} className="my-1 h-px bg-border" />
        ) : (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              onClose()
              item.onSelect()
            }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent',
              item.danger && 'text-destructive',
            )}
          >
            {item.icon ? <item.icon className="size-3.5 text-muted-foreground" /> : null}
            {item.label}
          </button>
        ),
      )}
    </div>
  )
}

function creationItems(dirPath, onCreate) {
  return [
    { label: 'Répertoire', icon: Folder, onSelect: () => onCreate(dirPath, 'folder') },
    { separator: true },
    { label: 'Fichier Markdown', icon: FileText, onSelect: () => onCreate(dirPath, 'markdown') },
    { label: 'Fichier YAML', icon: Box, onSelect: () => onCreate(dirPath, 'object') },
  ]
}

function TreeNode({ node, onCreate, depth = 0 }) {
  const activeFile = useProjectStore((state) => state.activeFile)
  const openFile = useProjectStore((state) => state.openFile)
  const movePath = useProjectStore((state) => state.movePath)
  const importHandles = useProjectStore((state) => state.importHandles)
  const renamePath = useProjectStore((state) => state.renamePath)
  const deletePath = useProjectStore((state) => state.deletePath)

  const [expanded, setExpanded] = useState(depth === 0)
  const [renaming, setRenaming] = useState(false)
  const [menu, setMenu] = useState(null)
  const [over, setOver] = useState(false)

  const isDirectory = node.kind === 'directory'
  const visual = isDirectory ? null : fileVisual(node.type)
  const baseName = isDirectory ? node.name : stripExtension(node.name)
  const extension = isDirectory ? '' : extensionOf(node.name)
  const active = activeFile === node.path
  const [draft, setDraft] = useState(baseName)

  const startRename = () => {
    setDraft(baseName)
    setRenaming(true)
  }

  const commitRename = async () => {
    const value = draft.trim()
    setRenaming(false)
    if (!value || value === baseName) return
    await renamePath(node.path, `${value}${extension}`)
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    setOver(false)
    if (dragSource) {
      const from = dragSource
      dragSource = null
      if (from === node.path) return
      await movePath(from, node.path)
      return
    }
    const handles = await handlesFromDataTransfer(event.dataTransfer)
    if (handles.length > 0) await importHandles(node.path, handles)
  }

  const openMenu = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY })
  }

  const items = [
    ...creationItems(node.path, onCreate),
    ...(isDirectory
      ? [
          { separator: true },
          { label: 'Renommer', icon: Pencil, onSelect: startRename },
          {
            label: 'Supprimer',
            icon: Trash2,
            danger: true,
            onSelect: () => {
              if (window.confirm(`Supprimer « ${node.path} » et son contenu ?`)) deletePath(node.path)
            },
          },
        ]
      : [
          { separator: true },
          { label: 'Renommer', icon: Pencil, onSelect: startRename },
          {
            label: 'Supprimer',
            icon: Trash2,
            danger: true,
            onSelect: () => {
              if (window.confirm(`Supprimer « ${node.path} » ?`)) deletePath(node.path)
            },
          },
        ]),
  ]

  const nameField = renaming ? (
    <input
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commitRename}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commitRename()
        if (event.key === 'Escape') setRenaming(false)
      }}
      className="min-w-0 flex-1 rounded border border-primary/40 bg-white px-1 py-0.5 text-xs text-foreground outline-none dark:bg-zinc-900"
    />
  ) : (
    <span
      className="min-w-0 flex-1 truncate"
      onDoubleClick={(event) => {
        event.stopPropagation()
        startRename()
      }}
    >
      {baseName}
    </span>
  )

  if (isDirectory) {
    return (
      <div
        className={cn(
          'shrink-0 rounded-lg border transition-colors',
          over
            ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
            : 'border-zinc-200/80 bg-zinc-50/70 dark:border-zinc-700/50 dark:bg-zinc-800/30',
        )}
        onDragEnter={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOver(false)
        }}
        onDrop={handleDrop}
      >
        <div
          role="button"
          tabIndex={0}
          draggable={!renaming}
          onDragStart={(event) => {
            dragSource = node.path
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', node.path)
          }}
          onContextMenu={openMenu}
          onClick={() => {
            if (!renaming) setExpanded((value) => !value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !renaming) setExpanded((value) => !value)
          }}
          className={cn(
            'flex h-7 cursor-pointer items-center gap-1.5 px-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200/50 dark:text-zinc-300 dark:hover:bg-zinc-700/40',
            expanded ? 'rounded-t-lg' : 'rounded-lg',
          )}
        >
          <button
            type="button"
            aria-label={expanded ? `Replier ${node.name}` : `Déplier ${node.name}`}
            onClick={(event) => {
              event.stopPropagation()
              setExpanded((value) => !value)
            }}
            className={cn('flex size-4 shrink-0 items-center justify-center hover:text-foreground', FOLDER_TEXT)}
          >
            {expanded ? <FolderOpen className="size-4" /> : <Folder className="size-4" />}
          </button>
          {nameField}
        </div>
        {expanded ? (
          <div className="flex flex-col gap-0.5 pt-0.5 pb-1 pl-2.5">
            {(node.children ?? []).length > 0 ? (
              (node.children ?? []).map((child) => (
                <TreeNode key={child.path} node={child} onCreate={onCreate} depth={depth + 1} />
              ))
            ) : (
              <span className="px-1 py-0.5 text-[10px] text-muted-foreground">Vide</span>
            )}
          </div>
        ) : null}
        <Menu menu={menu} items={items} onClose={() => setMenu(null)} />
      </div>
    )
  }

  const Icon = visual.Icon
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!renaming}
      onDragStart={(event) => {
        dragSource = node.path
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', node.path)
      }}
      onContextMenu={openMenu}
      onClick={() => {
        if (!renaming) openFile(node.path)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !renaming) openFile(node.path)
      }}
      className={cn(
        'flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-xs',
        visual.hover,
        active && visual.active,
        active && 'text-foreground',
      )}
    >
      <Icon className={cn('size-4 shrink-0', visual.text)} />
      {nameField}
      <Menu menu={menu} items={items} onClose={() => setMenu(null)} />
    </div>
  )
}

export function ExplorerPanel({ width = 280 }) {
  const tree = useProjectStore((state) => state.tree)
  const refresh = useProjectStore((state) => state.refresh)
  const movePath = useProjectStore((state) => state.movePath)
  const importHandles = useProjectStore((state) => state.importHandles)
  const [createTarget, setCreateTarget] = useState(null)
  const [menu, setMenu] = useState(null)
  const [rootOver, setRootOver] = useState(false)

  const children = useMemo(() => tree?.children ?? [], [tree])

  const onCreate = (dirPath, kind) => setCreateTarget({ dirPath, kind })

  const openRootMenu = (event) => {
    event.preventDefault()
    setMenu({ x: event.clientX, y: event.clientY })
  }

  const rootDrop = async (event) => {
    event.preventDefault()
    setRootOver(false)
    if (dragSource) {
      const path = dragSource
      dragSource = null
      await movePath(path, '')
      return
    }
    const handles = await handlesFromDataTransfer(event.dataTransfer)
    if (handles.length > 0) await importHandles('', handles)
  }

  return (
    <aside style={{ width }} className="flex h-full shrink-0 flex-col overflow-hidden border-r bg-sidebar">
      <div
        className={cn('flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto p-1.5', rootOver && 'bg-primary/5')}
        onContextMenu={openRootMenu}
        onDragEnter={(event) => {
          event.preventDefault()
          setRootOver(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setRootOver(false)
        }}
        onDrop={rootDrop}
      >
        {children.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            Notebook vide. Créez un fichier ou déposez des éléments.
          </p>
        ) : (
          children.map((node) => <TreeNode key={node.path} node={node} onCreate={onCreate} />)
        )}
      </div>

      <Menu
        menu={menu}
        items={[
          ...creationItems('', onCreate),
          { separator: true },
          { label: 'Rafraîchir', icon: RefreshCw, onSelect: refresh },
        ]}
        onClose={() => setMenu(null)}
      />

      <NewEntryDialog target={createTarget} onClose={() => setCreateTarget(null)} />
    </aside>
  )
}
