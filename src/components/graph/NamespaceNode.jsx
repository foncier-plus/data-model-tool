import { Handle, Position } from '@xyflow/react'
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NamespaceNode({ data }) {
  const { label, namespace, collapsed, count, edgeMode, onToggle } = data
  const showHandles = collapsed && edgeMode === 'aggregated'

  return (
    <div
      className={cn(
        'namespace-node pointer-events-none h-full w-full rounded-xl border-2 border-dashed',
        collapsed
          ? 'border-zinc-400/70 dark:border-zinc-500/70'
          : 'border-zinc-400/50 dark:border-zinc-500/40',
      )}
    >
      {showHandles ? (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-2 !border-0 !bg-zinc-400"
          style={{ top: 16 }}
        />
      ) : null}

      <div
        className="pointer-events-auto flex h-8 w-full items-center gap-1.5 rounded-t-xl px-2 text-xs font-semibold text-muted-foreground hover:bg-black/5"
        onClick={(event) => {
          event.stopPropagation()
          onToggle?.(namespace)
        }}
      >
        <button
          type="button"
          aria-label={collapsed ? `Déplier ${namespace}` : `Replier ${namespace}`}
          onClick={(event) => {
            event.stopPropagation()
            onToggle?.(namespace)
          }}
          className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-black/10"
        >
          {collapsed ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
        {collapsed ? (
          <Folder className="size-3.5 shrink-0" />
        ) : (
          <FolderOpen className="size-3.5 shrink-0" />
        )}
        <span className="truncate font-mono text-[11px]">{label}</span>
        <span className="flex-1" />
        <span className="text-[10px] font-normal">{count}</span>
      </div>

      {showHandles ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-2 !border-0 !bg-zinc-400"
          style={{ top: 16 }}
        />
      ) : null}
    </div>
  )
}
