import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { yaml as yamlLanguage } from '@codemirror/lang-yaml'
import { markdown as markdownLanguage } from '@codemirror/lang-markdown'
import { css as cssLanguage } from '@codemirror/lang-css'
import { lintGutter, linter } from '@codemirror/lint'
import { foldGutter } from '@codemirror/language'
import { useTheme } from 'next-themes'
import { yamlDiagnostics } from '@/lib/model/yamlErrors'
import { tomorrowTheme, yesterdayTheme } from './codemirrorTheme'
import { foldHoverHighlight } from './foldHover'

const SVG_NS = 'http://www.w3.org/2000/svg'

function foldMarker(open) {
  const span = document.createElement('span')
  span.className = 'cm-foldMarker'
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('width', '11')
  svg.setAttribute('height', '11')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('fill', 'currentColor')
  path.setAttribute('d', open ? 'M3 5h10L8 12z' : 'M5 3l7 5-7 5z')
  svg.appendChild(path)
  span.appendChild(svg)
  return span
}

function yamlLintExtension() {
  return linter((view) => {
    const text = view.state.doc.toString()
    return yamlDiagnostics(text)
      .filter((item) => item.line !== null)
      .map((item) => {
        const from = Math.max(0, item.pos)
        return {
          from,
          to: Math.min(from + 1, view.state.doc.length),
          severity: 'error',
          message: item.message,
        }
      })
  })
}

export function CodeEditor({ value, onChange, language = 'yaml', readOnly = false, onView }) {
  const { resolvedTheme } = useTheme()
  const theme = resolvedTheme === 'dark' ? yesterdayTheme : tomorrowTheme

  const extensions = useMemo(() => {
    const languages = { markdown: markdownLanguage, css: cssLanguage, yaml: yamlLanguage }
    const factory = languages[language] ?? yamlLanguage
    const list = [
      factory(),
      EditorView.lineWrapping,
      foldGutter({ markerDOM: foldMarker }),
      ...foldHoverHighlight,
    ]
    if (language === 'yaml') list.push(yamlLintExtension(), lintGutter())
    return list
  }, [language])

  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={theme}
      extensions={extensions}
      editable={!readOnly}
      onChange={onChange}
      onCreateEditor={(view) => onView?.(view)}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        autocompletion: false,
      }}
      className="h-full [&_.cm-editor]:h-full [&_.cm-scroller]:font-mono"
    />
  )
}
