import { useEffect, useState } from 'react'
import mermaid from 'mermaid'

let initialized = false
let sequence = 0

function ensureInit() {
  if (initialized) return
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'neutral',
    fontFamily: 'inherit',
  })
  initialized = true
}

export function Mermaid({ chart }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    ensureInit()
    const render = async () => {
      sequence += 1
      try {
        const result = await mermaid.render(`mermaid-${sequence}`, chart)
        if (active) {
          setSvg(result.svg)
          setError(null)
        }
      } catch (err) {
        if (active) {
          setSvg('')
          setError(err?.message ?? 'Erreur de rendu Mermaid')
        }
      }
    }
    render()
    return () => {
      active = false
    }
  }, [chart])

  if (error) return <pre className="mermaid-error">{error}</pre>
  if (!svg) return <div className="mermaid-loading">…</div>
  return <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
}
