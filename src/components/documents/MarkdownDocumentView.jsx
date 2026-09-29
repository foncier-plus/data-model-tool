import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import { toast } from 'sonner'
import { Settings } from 'lucide-react'
import 'katex/dist/katex.min.css'
import { CodeEditor } from '@/components/editor/CodeEditor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DocumentBreadcrumb } from './DocumentBreadcrumb'
import { Mermaid } from './Mermaid'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { slugify } from '@/lib/model/wiki'

function textOf(children) {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(textOf).join('')
  if (children?.props?.children) return textOf(children.props.children)
  return ''
}

function hastText(node) {
  if (!node) return ''
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(hastText).join('')
}

function makeHeading(Tag) {
  return function Heading({ children, ...props }) {
    return (
      <Tag id={slugify(textOf(children))} {...props}>
        {children}
      </Tag>
    )
  }
}

const COMPONENTS = {
  h1: makeHeading('h1'),
  h2: makeHeading('h2'),
  h3: makeHeading('h3'),
  h4: makeHeading('h4'),
  h5: makeHeading('h5'),
  h6: makeHeading('h6'),
  pre({ node, children, ...props }) {
    const codeNode = (node?.children ?? []).find((child) => child.tagName === 'code')
    const className = codeNode?.properties?.className
    const classes = Array.isArray(className) ? className : className ? [className] : []
    if (classes.includes('language-mermaid')) {
      return <Mermaid chart={hastText(codeNode).replace(/\n$/, '')} />
    }
    return <pre {...props}>{children}</pre>
  },
}

export function MarkdownDocumentView({ fileName }) {
  const readDocument = useProjectStore((state) => state.readDocument)
  const saveDocument = useProjectStore((state) => state.saveDocument)
  const anchor = useProjectStore((state) => state.anchor)
  const docRevision = useProjectStore((state) => state.docRevision)
  const markdownCss = useProjectStore((state) => state.markdownCss)
  const setMarkdownCss = useProjectStore((state) => state.setMarkdownCss)
  const saveMarkdownCss = useProjectStore((state) => state.saveMarkdownCss)
  const [text, setText] = useState('')
  const [cssOpen, setCssOpen] = useState(false)
  const [cssDraft, setCssDraft] = useState(markdownCss)
  const saved = useRef('')
  const ready = useRef(false)

  useEffect(() => {
    if (!cssOpen) return undefined
    const timer = setTimeout(() => saveMarkdownCss(cssDraft), 600)
    return () => clearTimeout(timer)
  }, [cssDraft, cssOpen, saveMarkdownCss])

  useEffect(() => {
    let active = true
    readDocument(fileName)
      .then((content) => {
        if (!active) return
        const value = content ?? ''
        saved.current = value
        setText(value)
        ready.current = true
      })
      .catch(() => toast.error(`Lecture impossible : ${fileName}`))
    return () => {
      active = false
    }
  }, [fileName, readDocument, docRevision])

  const save = useCallback(
    async (value) => {
      const ok = await saveDocument(fileName, value)
      if (ok) saved.current = value
      return ok
    },
    [fileName, saveDocument],
  )

  useEffect(() => {
    if (!ready.current || text === saved.current) return undefined
    const timer = setTimeout(() => save(text), 600)
    return () => clearTimeout(timer)
  }, [text, save])

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        save(text)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [save, text])

  useEffect(() => {
    if (!anchor || anchor.path !== fileName) return undefined
    let clearHighlight
    const timer = setTimeout(() => {
      const element = document.getElementById(anchor.id)
      if (!element) return
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      element.classList.add('md-anchor-highlight')
      clearHighlight = setTimeout(() => element.classList.remove('md-anchor-highlight'), 1800)
    }, 0)
    return () => {
      clearTimeout(timer)
      if (clearHighlight) clearTimeout(clearHighlight)
    }
  }, [anchor, fileName, text])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DocumentBreadcrumb fileName={fileName} />

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-hidden">
          <CodeEditor value={text} onChange={setText} language="markdown" />
        </div>
        <div role="separator" aria-orientation="vertical" className="w-px shrink-0 bg-border" />
        <div className="relative min-w-0 flex-1 overflow-hidden bg-background">
          <button
            type="button"
            title="Personnaliser le CSS du rendu Markdown (markdown.css)"
            aria-label="Personnaliser le CSS du rendu Markdown"
            onClick={() => {
              setCssDraft(markdownCss)
              setCssOpen(true)
            }}
            className="absolute top-2 right-3 z-10 flex size-8 items-center justify-center rounded-lg border bg-background/90 text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground"
          >
            <Settings className="size-4" />
          </button>
          <div className="markdown-preview h-full overflow-auto p-6">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeRaw, rehypeKatex]}
              components={COMPONENTS}
            >
              {text}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      <Dialog open={cssOpen} onOpenChange={setCssOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>markdown.css</DialogTitle>
            <DialogDescription>
              CSS appliqué au rendu Markdown (limité au panneau de rendu). Enregistré à la
              racine du notebook.
            </DialogDescription>
          </DialogHeader>
          <div className="h-[60vh] overflow-hidden rounded-md border">
            <CodeEditor
              value={cssDraft}
              onChange={(value) => {
                setCssDraft(value)
                setMarkdownCss(value)
              }}
              language="css"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
