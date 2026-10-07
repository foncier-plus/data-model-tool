import { Info } from 'lucide-react'
import { parseWikiLink } from '@/lib/model/wiki'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { cn } from '@/lib/utils'

function labelOf(link) {
  return `${link.path}${link.section ? `#${link.section}` : ''}`
}

export function AboutLink({ about, yamlFileName, className }) {
  const openWikiLink = useProjectStore((state) => state.openWikiLink)
  const link = parseWikiLink(about)
  if (!link) return null
  return (
    <button
      type="button"
      title={`Documentation : ${labelOf(link)}`}
      aria-label={`Ouvrir la documentation ${labelOf(link)}`}
      onClick={(event) => {
        event.stopPropagation()
        openWikiLink(yamlFileName, link.path, link.section)
      }}
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-full text-sky-600 hover:bg-sky-500/10 dark:text-sky-400',
        className,
      )}
    >
      <Info className="size-3" />
    </button>
  )
}
