import { useMemo, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { attributeRef, groupRef } from '@/lib/model/refs'
import { useTranslation } from '@/lib/i18n'

function projectOf(entry) {
  return entry.namespace ? entry.namespace.split('.')[0] : null
}

function shortRef(ref, project) {
  if (project && ref.startsWith(`${project}.`)) return ref.slice(project.length + 1)
  return ref
}

function buildOptions(entries, project) {
  const refs = new Set()
  for (const entry of entries) {
    if (projectOf(entry) !== project) continue
    const model = entry.model
    if (!model) continue
    const name = entry.qualifiedName ?? model.name
    refs.add(shortRef(name, project))
    for (const attribute of model.attributes ?? []) {
      refs.add(shortRef(attributeRef(name, null, attribute.name), project))
    }
    for (const group of model.groups ?? []) {
      refs.add(shortRef(groupRef(name, group.name), project))
      for (const attribute of group.attributes ?? []) {
        refs.add(shortRef(attributeRef(name, group.name, attribute.name), project))
      }
    }
  }
  return [...refs].sort()
}

export function OriginForm({ origin, onChange, resetKey, entries = [], namespace = null }) {
  const { t } = useTranslation()
  const [sources, setSources] = useState(origin?.from ?? [])
  const [formula, setFormula] = useState(origin?.formula ?? '')
  const [draft, setDraft] = useState('')
  const [lastKey, setLastKey] = useState(resetKey)

  if (resetKey !== lastKey) {
    setLastKey(resetKey)
    setSources(origin?.from ?? [])
    setFormula(origin?.formula ?? '')
    setDraft('')
  }

  const project = namespace ? namespace.split('.')[0] : null
  const refs = useMemo(() => buildOptions(entries, project), [entries, project])

  const commit = (nextSources, nextFormula) => {
    onChange({ from: nextSources, formula: nextFormula })
  }

  const updateSource = (index, value) => {
    const next = sources.map((source, i) => (i === index ? value : source))
    setSources(next)
    commit(next, formula)
  }

  const addSource = () => {
    const value = draft.trim()
    if (!value) return
    if (sources.includes(value)) {
      setDraft('')
      return
    }
    const next = [...sources, value]
    setSources(next)
    setDraft('')
    commit(next, formula)
  }

  const removeSource = (index) => {
    const next = sources.filter((_, i) => i !== index)
    setSources(next)
    commit(next, formula)
  }

  const updateFormula = (value) => {
    setFormula(value)
    commit(sources, value)
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <Label className="text-xs text-muted-foreground">{t('origin.sources')}</Label>

      <datalist id="origin-source-options">
        {refs.map((ref) => (
          <option key={ref} value={ref} />
        ))}
      </datalist>

      <div className="flex flex-col gap-1">
        {sources.map((source, index) => (
          <div key={`${source}-${index}`} className="group flex items-center gap-1">
            <Input
              list="origin-source-options"
              value={source}
              className="h-7 min-w-0 flex-1"
              onChange={(event) => updateSource(index, event.target.value)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-destructive opacity-0 group-hover:opacity-100"
              title={t('origin.source.remove.title')}
              onClick={() => removeSource(index)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}

        <div className="flex items-center gap-1">
          <Input
            list="origin-source-options"
            value={draft}
            placeholder={t('origin.source.add.placeholder')}
            className="h-7 min-w-0 flex-1 font-normal italic placeholder:italic"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addSource()
              }
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-emerald-600"
            title={t('origin.source.add.title')}
            disabled={!draft.trim()}
            onClick={addSource}
          >
            <Check className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t('origin.formula')}</Label>
        <Textarea
          value={formula}
          rows={4}
          placeholder=""
          onChange={(event) => updateFormula(event.target.value)}
        />
      </div>
    </div>
  )
}
