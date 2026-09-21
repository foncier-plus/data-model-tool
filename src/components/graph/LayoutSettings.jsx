import { Shuffle, X } from 'lucide-react'

export function LayoutSettings({
  collisionGap,
  stability,
  edgeStrength,
  onCollisionGap,
  onStability,
  onEdgeStrength,
  onRelayout,
  onClose,
}) {
  return (
    <div className="absolute bottom-3 left-14 z-20 w-64 rounded-lg border bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">Positionnement</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer les paramètres"
          className="rounded p-0.5 text-muted-foreground hover:bg-black/5"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-muted-foreground">
            <span>Espacement</span>
            <span className="font-mono text-foreground">{collisionGap} px</span>
          </span>
          <input
            type="range"
            min={0}
            max={48}
            step={4}
            value={collisionGap}
            onChange={(event) => onCollisionGap(Number(event.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-black/10 accent-primary"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-muted-foreground">
            <span>Stabilité</span>
            <span className="font-mono text-foreground">{Math.round(stability * 100)} %</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(stability * 100)}
            onChange={(event) => onStability(Number(event.target.value) / 100)}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-black/10 accent-primary"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-muted-foreground">
            <span>Attraction des liens</span>
            <span className="font-mono text-foreground">{edgeStrength.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={Math.round(edgeStrength * 100)}
            onChange={(event) => onEdgeStrength(Number(event.target.value) / 100)}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-black/10 accent-primary"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onRelayout}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 font-medium text-primary-foreground"
      >
        <Shuffle size={12} />
        Réorganiser
      </button>
    </div>
  )
}
