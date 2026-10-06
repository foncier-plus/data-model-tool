import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTranslation } from '@/lib/i18n'
import { useProjectStore } from '@/lib/store/useProjectStore'

export function ConflictDialog() {
  const { t } = useTranslation()
  const conflict = useProjectStore((state) => state.conflict)
  const reload = useProjectStore((state) => state.resolveConflictReload)
  const overwrite = useProjectStore((state) => state.resolveConflictOverwrite)
  const dismiss = useProjectStore((state) => state.dismissConflict)

  return (
    <Dialog open={Boolean(conflict)} onOpenChange={(open) => (!open ? dismiss() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('conflict.title')}</DialogTitle>
          <DialogDescription>
            <code>{conflict?.fileName}</code> {t('conflict.description')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={dismiss}>
            {t('conflict.keepEditing')}
          </Button>
          <Button variant="outline" onClick={overwrite}>
            {t('conflict.overwrite')}
          </Button>
          <Button onClick={reload}>{t('conflict.reload')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
