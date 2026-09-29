import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Loader2, Workflow } from 'lucide-react'
import NotFound from '@/pages/NotFound'
import Workspace from '@/pages/Workspace'
import { NotebookLanding } from '@/components/NotebookLanding'
import { useProjectStore } from '@/lib/store/useProjectStore'

function Splash() {
  return (
    <div className="flex h-svh items-center justify-center gap-3 text-muted-foreground">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Workflow className="size-4" />
      </span>
      <Loader2 className="size-4 animate-spin" />
      <span className="text-sm">Chargement…</span>
    </div>
  )
}

function Shell() {
  const handle = useProjectStore((state) => state.handle)
  const initNotebook = useProjectStore((state) => state.initNotebook)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    initNotebook().finally(() => {
      if (active) setReady(true)
    })
    return () => {
      active = false
    }
  }, [initNotebook])

  if (!ready) return <Splash />
  if (!handle) return <NotebookLanding />
  return <Workspace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Shell />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
