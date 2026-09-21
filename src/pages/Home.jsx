import { InstallPWA } from '@/components/install-pwa'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Badge variant="secondary">PWA</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Data Flow</h1>
        <p className="text-muted-foreground">
          Vite + Tailwind + shadcn/ui starter, installable and offline-ready.
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <CardDescription>
            Edit <code className="font-mono">src/pages/Home.jsx</code> to build
            the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => toast.success('It works!')}>
            Show a toast
          </Button>
          <InstallPWA />
        </CardContent>
      </Card>
    </main>
  )
}
