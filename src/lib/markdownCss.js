// Confine a notebook's markdown.css to the markdown preview only.
// Uses CSS @scope so selectors match relative to the preview container
// without needing an explicit `.markdown-preview` prefix.
export function scopeMarkdownCss(css) {
  const value = (css ?? '').trim()
  if (!value) return ''
  // Inside @scope, :root cannot match the preview container, so remap it to :scope
  // (which resolves to .markdown-preview). This lets `:root { --x: ... }` define
  // custom properties that inherit into the rendered markdown.
  const scoped = value.replace(/:root\b/g, ':scope')
  return `@scope (.markdown-preview) {\n${scoped}\n}\n`
}
