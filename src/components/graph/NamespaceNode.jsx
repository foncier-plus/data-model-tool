import { Handle, Position } from '@xyflow/react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NamespaceNode({ data }) {
  const { label, namespace, collapsed, count, edgeMode, onToggle } = data
  const showHandles = collapsed && edgeMode === 'aggregated'

  return (
    <div
      className={cn(
        'namespace-node pointer-events-none h-full w-full overflow-hidden rounded-lg border-2 border-dashed',
        collapsed
          ? 'border-sky-400/70 bg-sky-100/40 dark:border-sky-700/70 dark:bg-sky-900/30'
          : 'border-sky-300/70 bg-sky-50/40 dark:border-sky-800/60 dark:bg-sky-950/20',
      )}
    >
      {showHandles ? (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-2 !border-0 !bg-sky-400"
          style={{ top: 14, pointerEvents: 'auto' }}
        />
      ) : null}

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onToggle?.(namespace)
        }}
        aria-label={collapsed ? `Déplier ${namespace}` : `Replier ${namespace}`}
        className="pointer-events-auto flex h-7 w-full items-center gap-1 rounded-t-lg px-2 text-xs font-semibold text-sky-700 hover:bg-sky-100/70 dark:text-sky-300 dark:hover:bg-sky-900/40"
      >
        {collapsed ? (
          <ChevronRight className="size-3.5 shrink-0" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0" />
        )}
        <span className="truncate">{label}</span>
        <span className="flex-1" />
        <span className="text-[10px] font-normal opacity-70">{count}</span>
      </button>

      {showHandles ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-2 !border-0 !bg-sky-400"
          style={{ top: 14, pointerEvents: 'auto' }}
        />
      ) : null}
    </div>
  )
}
