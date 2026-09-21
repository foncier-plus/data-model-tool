import { Handle, Position } from '@xyflow/react'
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NamespaceNode({ data }) {
  const { label, collapsed, count, edgeMode, onToggle } = data
  const showHandles = collapsed && edgeMode === 'aggregated'

  return (
    <div
      className={cn(
        'pointer-events-none h-full w-full rounded-xl border-2 border-dashed',
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

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onToggle?.(label)
        }}
        className="pointer-events-auto flex h-8 w-full items-center gap-1.5 rounded-t-xl px-2 text-left text-xs font-semibold text-muted-foreground hover:bg-black/5"
      >
        {collapsed ? (
          <ChevronRight className="size-3.5 shrink-0" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0" />
        )}
        {collapsed ? (
          <Folder className="size-3.5 shrink-0" />
        ) : (
          <FolderOpen className="size-3.5 shrink-0" />
        )}
        <span className="truncate font-mono text-[11px]">{label}</span>
        <span className="flex-1" />
        <span className="text-[10px] font-normal">{count}</span>
      </button>

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
