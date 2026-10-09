import { useRef } from 'react'
import { PanelLeft, PanelRight } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// Zero-width separator: a single line between the main area and a side panel,
// with the collapse handle centred on that line. The handle shares the line
// colour (light grey) and turns blue together with the line when hovered, so it
// reads as part of the wire rather than a floating card.
//
// The handle can be dragged to resize the panel; a plain click collapses it.
export function SideRail({ side, collapsed, onToggle, onResize }) {
  const { t } = useTranslation()
  const dragged = useRef(false)
  const isLeft = side === 'left'
  const Icon = isLeft ? PanelLeft : PanelRight
  const label = isLeft
    ? t(collapsed ? 'view.showExplorer' : 'view.hideExplorer')
    : t(collapsed ? 'panel.show' : 'panel.hide')

  const handleMouseDown = (event) => {
    if (!onResize) return
    dragged.current = false
    const startX = event.clientX
    const onMove = (moveEvent) => {
      if (Math.abs(moveEvent.clientX - startX) > 3) dragged.current = true
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    onResize(event)
  }

  const handleClick = () => {
    if (dragged.current) {
      dragged.current = false
      return
    }
    onToggle()
  }

  return (
    <div role="separator" aria-orientation="vertical" className="group relative z-20 w-0 shrink-0">
      <span
        onMouseDown={onResize}
        className={cn(
          'absolute inset-y-0 left-1/2 w-2.5 -translate-x-1/2',
          onResize ? 'cursor-col-resize' : 'cursor-default',
        )}
      />
      <span className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-border transition-colors group-hover:bg-primary" />
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={!collapsed}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        className={cn(
          'absolute top-1/2 z-10 flex h-9 w-4 -translate-y-1/2 items-center justify-center',
          'bg-border text-muted-foreground transition-colors',
          'group-hover:bg-primary group-hover:text-primary-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          collapsed
            ? // Replié : le bouton épouse le bord, arrondi identique au bouton
              // ouvert (8px = demi-largeur) du seul côté visible.
              isLeft
              ? 'left-0 rounded-l-none rounded-r-[0.5rem]'
              : 'right-0 rounded-r-none rounded-l-[0.5rem]'
            : 'left-1/2 -translate-x-1/2 rounded-full',
        )}
      >
        <Icon className="size-3.5" />
      </button>
    </div>
  )
}
