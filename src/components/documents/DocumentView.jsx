import { GraphView } from '@/components/graph/GraphView'
import { FileWarning } from 'lucide-react'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { classifyFile } from '@/lib/fs/documentType'
import { DocumentBreadcrumb } from './DocumentBreadcrumb'
import { YamlDocumentView } from './YamlDocumentView'
import { MarkdownDocumentView } from './MarkdownDocumentView'
import { PdfDocumentView } from './PdfDocumentView'
import { ImageDocumentView } from './ImageDocumentView'

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
      <FileWarning className="size-5" />
      <p>Ouvrez un fichier dans l'explorateur pour l'afficher ici.</p>
    </div>
  )
}

function YamlWorkspaceView({ fileName, entries, selection, onSelect }) {
  const hasEntries = entries.some((entry) => entry.fileName === fileName)
  return (
    <div className="flex h-full min-h-0 flex-col">
      <DocumentBreadcrumb fileName={fileName} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r">
          <YamlDocumentView fileName={fileName} />
        </div>
        <div className="hidden min-w-0 flex-1 overflow-hidden lg:block">
          {hasEntries ? (
            <GraphView
              entries={entries}
              selection={selection}
              onSelect={onSelect}
              selectedObjects={null}
              scope="file"
              fileName={fileName}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Aucun objet à afficher dans ce fichier.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function DocumentView({ entries = [], selection, onSelect }) {
  const activeFile = useProjectStore((state) => state.activeFile)

  if (!activeFile) return <EmptyState />

  const type = classifyFile(activeFile)
  const key = activeFile

  if (type === 'yaml') {
    return (
      <YamlWorkspaceView
        key={key}
        fileName={activeFile}
        entries={entries}
        selection={selection}
        onSelect={onSelect}
      />
    )
  }
  if (type === 'markdown') return <MarkdownDocumentView key={key} fileName={activeFile} />
  if (type === 'pdf') return <PdfDocumentView key={key} fileName={activeFile} />
  if (type === 'image') return <ImageDocumentView key={key} fileName={activeFile} />
  return (
    <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
      Format non pris en charge : {activeFile}
    </div>
  )
}
