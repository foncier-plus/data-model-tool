import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import { Settings } from 'lucide-react'
import 'katex/dist/katex.min.css'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { SourceEditor } from '@/components/editor/SourceEditor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

export function MarkdownEditor({ fileName, text, onChange, onCursor }) {
  return (
    <SourceEditor
      language="markdown"
      fileName={fileName}
      value={text}
      onChange={onChange}
      onCursor={onCursor}
    />
  )
}

export function MarkdownPreview({ fileName, text }) {
  const anchor = useProjectStore((state) => state.anchor)
  const setActiveHeading = useProjectStore((state) => state.setActiveHeading)
  const markdownCss = useProjectStore((state) => state.markdownCss)
  const setMarkdownCss = useProjectStore((state) => state.setMarkdownCss)
  const saveMarkdownCss = useProjectStore((state) => state.saveMarkdownCss)
  const containerRef = useRef(null)
  const [cssOpen, setCssOpen] = useState(false)
  const [cssDraft, setCssDraft] = useState(markdownCss)

  useEffect(() => {
    if (!cssOpen) return undefined
    const timer = setTimeout(() => saveMarkdownCss(cssDraft), 600)
    return () => clearTimeout(timer)
  }, [cssDraft, cssOpen, saveMarkdownCss])

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

  const handleScroll = () => {
    const container = containerRef.current
    if (!container) return
    const headings = container.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')
    const top = container.getBoundingClientRect().top + 12
    let current = null
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= top) current = heading.id
      else break
    }
    setActiveHeading(current)
  }

  return (
    <div className="relative h-full min-h-0">
      <button
        type="button"
        title="Personnaliser le CSS du rendu Markdown (markdown.css)"
        aria-label="Personnaliser le CSS du rendu Markdown"
        onClick={() => {
          setCssDraft(markdownCss)
          setCssOpen(true)
        }}
        className="absolute top-3 right-3 z-20 flex size-8 items-center justify-center rounded-lg border bg-background/95 text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground"
      >
        <Settings className="size-4" />
      </button>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="markdown-preview h-full overflow-auto bg-background p-6"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeRaw, rehypeKatex]}
          components={COMPONENTS}
        >
          {text}
        </ReactMarkdown>
      </div>

      <Dialog open={cssOpen} onOpenChange={setCssOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>markdown.css</DialogTitle>
            <DialogDescription>
              CSS appliqué au rendu Markdown (limité au panneau de rendu). Enregistré à la racine
              du notebook.
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
