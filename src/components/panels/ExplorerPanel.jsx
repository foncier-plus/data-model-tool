import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Package,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { buildNamespaceTree, subtreeObjectIds } from '@/lib/model/hierarchy'
import { NewEntryDialog } from '@/components/NewEntryDialog'
import { cn } from '@/lib/utils'

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

function FolderRow({
  folder,
  depth,
  project,
  isProject,
  selectedObjects,
  onToggleFolder,
  onToggleProject,
  onCreate,
  expanded,
  onToggleExpand,
}) {
  const ids = [...subtreeObjectIds(folder)]
  const selectedCount = ids.filter((id) => selectedObjects.has(id)).length
  const checked = ids.length > 0 && selectedCount === ids.length
  const indeterminate = selectedCount > 0 && selectedCount < ids.length

  return (
    <div
      className="group/row flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent"
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
      {isProject ? null : (
        <TriCheckbox
          checked={checked}
          indeterminate={indeterminate}
          onChange={() => onToggleFolder(ids, project)}
          label={`Sélectionner ${folder.namespace}`}
        />
      )}
      <button
        type="button"
        onClick={() => (isProject ? onToggleProject(ids, project) : onToggleExpand())}
        aria-label={isProject ? `Afficher le projet ${folder.name}` : undefined}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        {isProject ? (
          <Package className="size-3.5 shrink-0 text-primary/70" />
        ) : expanded ? (
          <FolderOpen className="size-3.5 shrink-0" />
        ) : (
          <Folder className="size-3.5 shrink-0" />
        )}
        <span className={isProject ? 'truncate font-semibold' : 'truncate font-mono'}>
          {folder.name}
        </span>
        <span className="text-[10px] text-muted-foreground/60">{ids.length}</span>
      </button>
      <button
        type="button"
        onClick={() => onCreate(isProject ? 'namespace' : 'object')}
        aria-label={
          isProject
            ? `Nouveau namespace dans ${folder.name}`
            : `Nouvel objet dans ${folder.namespace}`
        }
        title={isProject ? 'Nouveau namespace' : 'Nouvel objet'}
        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-black/10 hover:text-foreground group-hover/row:opacity-100"
      >
        <Plus className="size-3.5" />
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

export function ExplorerPanel({
  entries,
  namespaces = [],
  selectedObjects,
  onChange,
  onRefresh,
  width = 256,
}) {
  const tree = useMemo(() => buildNamespaceTree(entries, namespaces), [entries, namespaces])
  const [expanded, setExpanded] = useState(() => new Set())
  const [createTarget, setCreateTarget] = useState(null)

  const projectByObject = useMemo(() => {
    const map = new Map()
    for (const entry of entries) {
      map.set(entry.qualifiedName, entry.namespace ? entry.namespace.split('.')[0] : null)
    }
    return map
  }, [entries])

  const activeProject = useMemo(() => {
    for (const id of selectedObjects) return projectByObject.get(id) ?? null
    return null
  }, [selectedObjects, projectByObject])

  const toggleExpand = (namespace) =>
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(namespace)) next.delete(namespace)
      else next.add(namespace)
      return next
    })

  const commit = (project, mutate) => {
    const next = new Set()
    for (const id of selectedObjects) {
      if (projectByObject.get(id) === project) next.add(id)
    }
    mutate(next)
    onChange(next)
  }

  const toggleObject = (qualifiedName) => {
    const project = projectByObject.get(qualifiedName)
    commit(project, (next) => {
      if (next.has(qualifiedName)) next.delete(qualifiedName)
      else next.add(qualifiedName)
    })
  }

  const toggleFolder = (ids, project) => {
    commit(project, (next) => {
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id))
      if (allSelected) for (const id of ids) next.delete(id)
      else for (const id of ids) next.add(id)
    })
  }

  const toggleProject = (ids, project) => {
    commit(project, (next) => {
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id))
      if (allSelected) for (const id of ids) next.delete(id)
      else for (const id of ids) next.add(id)
    })
  }

  const renderFolder = (folder, depth, project, isProject) => {
    const active = isProject && activeProject === project
    const body = (
      <>
        <FolderRow
          folder={folder}
          depth={depth}
          project={project}
          isProject={isProject}
          selectedObjects={selectedObjects}
          onToggleFolder={toggleFolder}
          onToggleProject={toggleProject}
          onCreate={(kind) =>
            setCreateTarget({
              kind,
              base: isProject ? folder.name : folder.namespace.replace(/\./g, '/'),
            })
          }
          expanded={expanded.has(folder.namespace)}
          onToggleExpand={() => toggleExpand(folder.namespace)}
        />
        {expanded.has(folder.namespace) ? (
          <>
            {[...folder.folders.values()].map((child) =>
              renderFolder(child, depth + 1, project, false),
            )}
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
      </>
    )

    if (!isProject) return <div key={folder.namespace}>{body}</div>

    return (
      <div
        key={folder.namespace}
        className={cn(
          'rounded-md border p-1 transition-colors',
          active ? 'border-primary/50 bg-primary/5' : 'border-transparent',
        )}
      >
        {body}
      </div>
    )
  }

  return (
    <aside
      style={{ width }}
      className="flex h-full shrink-0 flex-col overflow-hidden bg-muted/30"
    >
      <div className="flex items-center justify-between gap-1 border-b px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">Projets</span>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Rafraîchir"
          title="Rafraîchir"
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <RefreshCw className="size-3.5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto p-1.5">
        {[...tree.folders.values()].map((folder) => renderFolder(folder, 0, folder.name, true))}
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
          <p className="p-3 text-xs text-muted-foreground">Aucun projet.</p>
        ) : null}
      </div>
      <NewEntryDialog target={createTarget} onClose={() => setCreateTarget(null)} />
    </aside>
  )
}
