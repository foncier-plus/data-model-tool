const YAML_EXTENSIONS = ['.yaml', '.yml']
const MARKDOWN_EXTENSIONS = ['.md', '.markdown']
const PDF_EXTENSIONS = ['.pdf']
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif']

export function extensionOf(name) {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

export function classifyFile(name) {
  const extension = extensionOf(name)
  if (YAML_EXTENSIONS.includes(extension)) return 'yaml'
  if (MARKDOWN_EXTENSIONS.includes(extension)) return 'markdown'
  if (PDF_EXTENSIONS.includes(extension)) return 'pdf'
  if (IMAGE_EXTENSIONS.includes(extension)) return 'image'
  return 'other'
}

export function isSupportedFile(name) {
  return classifyFile(name) !== 'other'
}

export function isHidden(name) {
  return name.startsWith('.')
}
