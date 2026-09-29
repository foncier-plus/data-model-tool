import { Handle, Position } from '@xyflow/react'
import { Boxes } from 'lucide-react'
import { withAlpha } from '@/lib/colors'
import { cn } from '@/lib/utils'

export function DependencyNode({ data }) {
  return (
    <div
      className={cn(
        'relative flex h-9 items-center gap-2 rounded-md border border-dashed bg-muted/70 px-2 text-xs transition-opacity',
        data.dimmed && 'opacity-40',
      )}
      style={{ borderColor: withAlpha(data.color ?? '#71717a', 0.6) }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-1.5 !border-0"
        style={{ background: data.color }}
      />
      <Boxes className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate font-mono">{data.label}</span>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-1.5 !border-0"
        style={{ background: data.color }}
      />
    </div>
  )
}
