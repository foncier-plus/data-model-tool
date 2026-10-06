import { useMemo } from 'react'
import { attributeRef, buildIndex, collectOrigins, resolveRef } from '@/lib/model/refs'
import { resolveSelection } from '@/lib/selection'
import { useTranslation } from '@/lib/i18n'
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
  const { t } = useTranslation()
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
        <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
          {t('origin.sources')}
        </span>
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
            {t('origin.formula')}
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

export function FormulaPanel() {
  const { t } = useTranslation()
  const selection = useProjectStore((state) => state.selection)
  const entries = useProjectStore((state) => state.entries)
  const select = useProjectStore((state) => state.select)
  const index = useMemo(() => buildIndex(entries), [entries])
  const resolved = resolveSelection(entries, selection)

  if (!resolved) return null

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

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('formula.empty')}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <OriginCard
          key={row.ref}
          row={row}
          index={index}
          namespace={resolved.entry.namespace ?? null}
          onSelect={handleSelect}
        />
      ))}
    </div>
  )
}
