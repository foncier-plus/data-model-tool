import { Handle, Position } from '@xyflow/react'
import { AlertTriangle, ChevronDown, ChevronRight, Equal, Pencil, Sigma } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { typeStyle } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { rowStateClass } from './entityNodeUtils'

export function Chevron({ collapsed, onClick, label }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={!collapsed}
      className="flex size-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
    </button>
  )
}

export function EntityRow({
  rowRef,
  label,
  type,
  optional,
  example,
  kind = 'none',
  warning,
  color,
  edgeMode,
  active,
  upstream,
  downstream,
  hasHighlight,
  dim,
  noTarget,
  noSource,
  onClick,
  description,
}) {
  const { t } = useTranslation()
  const stateClass = rowStateClass({ active, upstream, downstream, hasHighlight, dim })

  return (
    <div className="relative">
      {edgeMode === 'attribute' && !noTarget ? (
        <Handle
          type="target"
          position={Position.Left}
          id={rowRef}
          className="!size-1.5 !border-0"
          style={{ background: color }}
        />
      ) : null}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'grid w-full grid-cols-[16px_minmax(0,1fr)_auto_auto] items-center gap-2 rounded px-1.5 py-0.5 text-left text-[11px] hover:bg-accent',
              stateClass,
            )}
            onClick={(event) => {
              event.stopPropagation()
              onClick()
            }}
          >
            <span
              className={cn(
                'flex size-4 items-center justify-center rounded-sm',
                kind === 'formula' ? 'bg-blue-400' : kind === 'linked' ? 'bg-emerald-400' : 'bg-zinc-200',
              )}
              title={
                kind === 'formula'
                  ? t('attribute.formula')
                  : kind === 'linked'
                    ? t('attribute.linked')
                    : t('attribute.simple')
              }
            >
              {kind === 'formula' ? (
                <Sigma className="size-2.5 text-white" />
              ) : kind === 'linked' ? (
                <Equal className="size-2.5 text-white" />
              ) : (
                <Pencil className="size-2.5 text-zinc-400" />
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                className={cn(
                  'truncate font-mono',
                  optional ? 'font-normal italic' : 'font-bold',
                  warning && 'text-destructive',
                )}
              >
                {label}
              </span>
              {example ? (
                <span className="truncate text-[10px] italic text-muted-foreground">{example}</span>
              ) : null}
            </span>
            {warning ? <AlertTriangle className="size-3 text-destructive" /> : <span />}
            {type ? (
              <span className={cn('rounded px-1 font-mono text-[10px]', typeStyle(type))}>{type}</span>
            ) : (
              <span />
            )}
          </button>
        </TooltipTrigger>
        {description ? (
          <TooltipContent side="right" className="max-w-72 whitespace-pre-wrap font-normal">
            {description}
          </TooltipContent>
        ) : null}
      </Tooltip>

      {edgeMode === 'attribute' && !noSource ? (
        <Handle
          type="source"
          position={Position.Right}
          id={rowRef}
          className="!size-1.5 !border-0"
          style={{ background: color }}
        />
      ) : null}
    </div>
  )
}
