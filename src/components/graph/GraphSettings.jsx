export function GraphSettings({ autoCollapse, editMode, onAutoCollapse, onEditMode }) {
  return (
    <div className="absolute right-3 top-3 z-20 flex flex-col gap-1.5 rounded-lg border bg-background/95 p-2 text-xs shadow-lg backdrop-blur">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={autoCollapse}
          onChange={(event) => onAutoCollapse(event.target.checked)}
          aria-label="Repli automatique"
          className="size-3.5 cursor-pointer accent-primary"
        />
        <span>Repli automatique</span>
      </label>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={editMode}
          onChange={(event) => onEditMode(event.target.checked)}
          aria-label="Mode édition"
          className="size-3.5 cursor-pointer accent-primary"
        />
        <span>Mode édition</span>
      </label>
    </div>
  )
}
