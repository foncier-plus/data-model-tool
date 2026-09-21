import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'
import { buildNamespaceTree, subtreeObjectIds } from '@/lib/model/hierarchy'

function TriCheckbox({ checked, indeterminate, onChange, label }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="size-3.5 shrink-0 cursor-pointer accent-primary"
    />
  )
}

function FolderRow({ folder, depth, selectedObjects, onToggleFolder, expanded, onToggleExpand }) {
  const ids = [...subtreeObjectIds(folder)]
  const selectedCount = ids.filter((id) => selectedObjects.has(id)).length
  const checked = ids.length > 0 && selectedCount === ids.length
  const indeterminate = selectedCount > 0 && selectedCount < ids.length

  return (
    <div
      className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent"
      style={{ paddingLeft: depth * 12 + 4 }}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        aria-label={`${expanded ? 'Replier' : 'Déplier'} ${folder.name}`}
        className="flex size-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
      </button>
      <TriCheckbox
        checked={checked}
        indeterminate={indeterminate}
        onChange={() => onToggleFolder(folder, ids)}
        label={`Sélectionner ${folder.namespace}`}
      />
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        {expanded ? (
          <FolderOpen className="size-3.5 shrink-0" />
        ) : (
          <Folder className="size-3.5 shrink-0" />
        )}
        <span className="truncate font-mono">{folder.name}</span>
        <span className="text-[10px] text-muted-foreground/60">{ids.length}</span>
      </button>
    </div>
  )
}

function FileRow({ file, depth, selectedObjects, onToggleObject }) {
  const checked = selectedObjects.has(file.qualifiedName)
  return (
    <div
      className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent"
      style={{ paddingLeft: depth * 12 + 4 }}
    >
      <span className="flex size-4 shrink-0" />
      <TriCheckbox
        checked={checked}
        indeterminate={false}
        onChange={() => onToggleObject(file.qualifiedName)}
        label={`Sélectionner ${file.qualifiedName}`}
      />
      <button
        type="button"
        onClick={() => onToggleObject(file.qualifiedName)}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs hover:text-foreground"
      >
        <FileText className="size-3.5 shrink-0 text-muted-foreground/60" />
        <span className="truncate font-mono">{file.name}</span>
      </button>
    </div>
  )
}

export function ExplorerPanel({ entries, selectedObjects, onChange }) {
  const tree = buildNamespaceTree(entries)
  const [expanded, setExpanded] = useState(() => new Set())

  const allIds = useMemo(() => [...subtreeObjectIds(tree)], [tree])
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedObjects.has(id))

  const toggleExpand = (namespace) =>
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(namespace)) next.delete(namespace)
      else next.add(namespace)
      return next
    })

  const toggleObject = (qualifiedName) => {
    const next = new Set(selectedObjects)
    if (next.has(qualifiedName)) next.delete(qualifiedName)
    else next.add(qualifiedName)
    onChange(next)
  }

  const toggleFolder = (folder, ids) => {
    const next = new Set(selectedObjects)
    const allSelected = ids.length > 0 && ids.every((id) => selectedObjects.has(id))
    if (allSelected) {
      for (const id of ids) next.delete(id)
    } else {
      for (const id of ids) next.add(id)
    }
    onChange(next)
  }

  const renderFolder = (folder, depth) => (
    <div key={folder.namespace}>
      <FolderRow
        folder={folder}
        depth={depth}
        selectedObjects={selectedObjects}
        onToggleFolder={toggleFolder}
        expanded={expanded.has(folder.namespace)}
        onToggleExpand={() => toggleExpand(folder.namespace)}
      />
      {expanded.has(folder.namespace) ? (
        <>
          {[...folder.folders.values()].map((child) => renderFolder(child, depth + 1))}
          {folder.files.map((file) => (
            <FileRow
              key={file.qualifiedName}
              file={file}
              depth={depth + 1}
              selectedObjects={selectedObjects}
              onToggleObject={toggleObject}
            />
          ))}
        </>
      ) : null}
    </div>
  )

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-muted/30">
      <div className="flex items-center justify-between gap-1 border-b px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">Explorateur</span>
        <div className="flex items-center gap-1">
          {allIds.length > 0 && !allSelected ? (
            <button
              type="button"
              onClick={() => onChange(new Set(allIds))}
              className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Tout
            </button>
          ) : null}
          {selectedObjects.size > 0 ? (
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Aucun
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto p-1.5">
        {[...tree.folders.values()].map((folder) => renderFolder(folder, 0))}
        {tree.files.map((file) => (
          <FileRow
            key={file.qualifiedName}
            file={file}
            depth={0}
            selectedObjects={selectedObjects}
            onToggleObject={toggleObject}
          />
        ))}
        {tree.files.length === 0 && tree.folders.size === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">Aucun objet.</p>
        ) : null}
      </div>
    </aside>
  )
}
