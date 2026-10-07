import { AlertTriangle } from 'lucide-react'
import { groupRef } from '@/lib/model/refs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { withAlpha } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { Chevron } from './EntityRow'
import { groupBackground, isUnresolved } from './entityNodeUtils'

export function EntityGroup({ data, group, collapsed, onToggle, activate, renderRow }) {
  const { qualifiedName, index, namespace, color, selectedRef, upstreamRefs, downstreamRefs, hasHighlight, dimmed } =
    data
  const ref = groupRef(qualifiedName, group.name)
  const active = selectedRef === ref
  const upstream = upstreamRefs?.has(ref) ?? false
  const downstream = downstreamRefs?.has(ref) ?? false

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: withAlpha(color, 0.35) }}>
      <div
        className={cn(
          'flex items-center gap-1 px-1',
          upstream && 'ring-1 ring-sky-400',
          downstream && 'ring-1 ring-emerald-400',
          (hasHighlight || dimmed) && !active && 'opacity-40',
        )}
        style={{ background: groupBackground(color, { active, upstream, downstream }) }}
      >
        <Chevron collapsed={collapsed} onClick={onToggle} label={group.name} />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="flex h-6 min-w-0 flex-1 items-center gap-1.5 pr-1 text-left text-[11px] font-medium hover:brightness-95"
              onClick={(event) => {
                event.stopPropagation()
                activate({
                  kind: 'group',
                  objectName: qualifiedName,
                  groupName: group.name,
                  attributeName: null,
                  ref,
                })
              }}
            >
              <span className="truncate">{group.name}</span>
              <span className="flex-1" />
              <span className="text-[10px] font-normal text-muted-foreground">
                {group.attributes?.length ?? 0}
              </span>
              {isUnresolved(group.origin, index, namespace) ? (
                <AlertTriangle className="size-3 shrink-0 text-destructive" />
              ) : null}
            </button>
          </TooltipTrigger>
          {group.description ? (
            <TooltipContent side="right" className="max-w-72 whitespace-pre-wrap font-normal">
              {group.description}
            </TooltipContent>
          ) : null}
        </Tooltip>
      </div>

      {collapsed ? null : (
        <div className="flex flex-col gap-0.5 p-1">
          {(group.attributes ?? []).map((attribute) => renderRow(attribute, group.name))}
        </div>
      )}
    </div>
  )
}
