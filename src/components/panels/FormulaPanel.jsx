import { ScrollArea } from '@/components/ui/scroll-area'
import { attributeRef, collectOrigins, resolveRef } from '@/lib/model/refs'
import { resolveSelection } from '@/lib/selection'
import { useProjectStore } from '@/lib/store/useProjectStore'

function rowsFor(resolved, selection) {
  const model = resolved.entry.model
  if (!model) return []
  const name = resolved.entry.qualifiedName ?? model.name

  if (resolved.attribute) {
    return [
      {
        ref: selection.ref,
        origin: resolved.attribute.origin ?? { from: [], formula: '' },
      },
    ]
  }

  if (resolved.group) {
    return (resolved.group.attributes ?? [])
      .filter((attribute) => attribute.origin)
      .map((attribute) => ({
        ref: attributeRef(name, resolved.group.name, attribute.name),
        origin: attribute.origin,
      }))
  }

  return collectOrigins(model, name).map((origin) => ({ ref: origin.ref, origin: origin.origin }))
}

function shortRef(ref, namespace) {
  return namespace && ref.startsWith(`${namespace}.`) ? ref.slice(namespace.length + 1) : ref
}

function OriginCard({ row, index, namespace, onSelect }) {
  const sources = row.origin.from ?? []
  const element = resolveRef(row.ref, index)

  return (
    <button
      type="button"
      onClick={() => element && onSelect(element, row.ref)}
      className="flex flex-col gap-3 rounded-md border p-3 text-left transition-colors hover:bg-accent/50"
    >
      <div className="flex flex-col gap-0.5">
        <code className="text-xs font-bold">{shortRef(row.ref, namespace)}</code>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] tracking-wide text-muted-foreground uppercase">Sources</span>
        {sources.length ? (
          <div className="flex flex-col gap-0.5">
            {sources.map((ref) => {
              const ok = Boolean(resolveRef(ref, index, namespace))
              return (
                <code
                  key={ref}
                  className={ok ? 'text-xs' : 'text-xs text-destructive line-through'}
                >
                  - {shortRef(ref, namespace)}
                </code>
              )
            })}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {row.origin.formula ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
            Formula
          </span>
          <pre className="rounded bg-muted p-2 text-xs whitespace-pre-wrap">
            {row.origin.formula}
          </pre>
        </div>
      ) : (
        <div className="text-center font-mono text-sm text-muted-foreground">=</div>
      )}
    </button>
  )
}

export function FormulaPanel({ entries, selection, index }) {
  const select = useProjectStore((state) => state.select)
  const resolved = resolveSelection(entries, selection)

  if (!resolved) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Select an object, group or attribute to inspect its origin.
      </p>
    )
  }

  const rows = rowsFor(resolved, selection).filter(
    (row) => row.origin?.from?.length || row.origin?.formula,
  )

  const handleSelect = (element, ref) => {
    select({
      kind: 'attribute',
      objectName: element.objectName,
      groupName: element.groupName ?? null,
      attributeName: element.attributeName,
      ref,
    })
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-4">
        <div hidden>
          <p className="text-sm font-medium">{shortRef(selection.ref, resolved.entry.namespace)}</p>
          <p className="text-xs text-muted-foreground">
            {rows.length} derivation{rows.length > 1 ? 's' : ''}
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No formula for this selection.</p>
        ) : (
          rows.map((row) => (
            <OriginCard
              key={row.ref}
              row={row}
              index={index}
              namespace={resolved.entry.namespace ?? null}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </ScrollArea>
  )
}
