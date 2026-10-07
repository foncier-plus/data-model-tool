const YAML_EXTENSIONS = ['.yaml', '.yml']
const PROJECT_SUFFIXES = ['.project.yaml', '.project.yml']
const OBJECT_SUFFIXES = ['.object.yaml', '.object.yml']
const MARKDOWN_EXTENSIONS = ['.md', '.markdown']
const PDF_EXTENSIONS = ['.pdf']
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif']

export function extensionOf(name) {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

// Split a file name into its display base and its semantic extension. The type
// extension (`.project`, `.object`) is hidden from the base but kept in the
// extension so renaming preserves it.
export function splitFileName(name) {
  const lower = name.toLowerCase()
  for (const suffix of [...PROJECT_SUFFIXES, ...OBJECT_SUFFIXES]) {
    if (lower.endsWith(suffix)) {
      return { base: name.slice(0, -suffix.length), extension: name.slice(-suffix.length) }
    }
  }
  const extension = extensionOf(name)
  return { base: extension ? name.slice(0, -extension.length) : name, extension }
}

export function classifyFile(name) {
  const lower = name.toLowerCase()
  if (PROJECT_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return 'project'
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
