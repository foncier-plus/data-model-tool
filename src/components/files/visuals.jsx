import {
  Box,
  FileText,
  FileType2,
  Image as ImageIcon,
} from 'lucide-react'

export const FOLDER_TEXT = 'text-zinc-400'

export const FILE_VISUALS = {
  yaml: {
    Icon: Box,
    text: 'text-rose-300',
    hover: 'hover:bg-rose-50/70 dark:hover:bg-rose-950/25',
    active: 'bg-rose-50 dark:bg-rose-950/30',
  },
  markdown: {
    Icon: FileText,
    text: 'text-sky-300',
    hover: 'hover:bg-sky-50/70 dark:hover:bg-sky-950/25',
    active: 'bg-sky-50 dark:bg-sky-950/30',
  },
  pdf: {
    Icon: FileType2,
    text: 'text-emerald-300',
    hover: 'hover:bg-emerald-50/70 dark:hover:bg-emerald-950/25',
    active: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  image: {
    Icon: ImageIcon,
    text: 'text-emerald-300',
    hover: 'hover:bg-emerald-50/70 dark:hover:bg-emerald-950/25',
    active: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
}

export function fileVisual(type) {
  return FILE_VISUALS[type] ?? FILE_VISUALS.yaml
}
