import { useMemo } from 'react'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { slugify } from '@/lib/model/wiki'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

function headingsOf(text) {
  const out = []
  const lines = (text ?? '').split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/)
    if (match) {
      out.push({
        level: match[1].length,
        label: match[2].trim(),
        id: slugify(match[2]),
        line: index + 1,
      })
    }
  }
  return out
}

export function MarkdownOutline({ fileName, text }) {
  const { t } = useTranslation()
  const activeHeading = useProjectStore((state) => state.activeHeading)
  const scrollToHeading = useProjectStore((state) => state.scrollToHeading)
  const headings = useMemo(() => headingsOf(text), [text])

  if (headings.length === 0) {
    return <p className="p-4 text-xs text-muted-foreground">{t('outline.empty')}</p>
  }

  return (
    <div className="flex flex-col gap-0.5 overflow-auto p-2">
      {headings.map((heading, index) => (
        <button
          key={`${heading.id}-${index}`}
          type="button"
          onClick={() => scrollToHeading(fileName, heading.id, heading.line)}
          style={{ paddingLeft: `${(heading.level - 1) * 12 + 6}px` }}
          className={cn(
            'flex min-w-0 items-center gap-1.5 rounded py-0.5 pr-2 text-left hover:bg-accent',
            heading.level === 1 ? 'text-sm' : heading.level === 2 ? 'text-xs' : 'text-[11px]',
            activeHeading === heading.id
              ? 'font-semibold text-primary'
              : heading.level <= 2
                ? 'text-foreground'
                : 'text-muted-foreground',
          )}
        >
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
            {'#'.repeat(heading.level)}
          </span>
          <span className="min-w-0 truncate">{heading.label}</span>
        </button>
      ))}
    </div>
  )
}
