const WIKI_LINK = /^\[\[([^\]]+)\]\]$/

export function parseWikiLink(text) {
  const value = (text ?? '').trim()
  if (!value) return null
  const match = value.match(WIKI_LINK)
  if (!match) return null
  const inner = match[1].trim()
  const hash = inner.indexOf('#')
  const path = (hash === -1 ? inner : inner.slice(0, hash)).trim()
  const section = (hash === -1 ? '' : inner.slice(hash + 1)).trim()
  if (!path) return null
  return { raw: value, path, section }
}

export function formatWikiLink(path, section = '') {
  return `[[${path}${section ? `#${section}` : ''}]]`
}

export function slugify(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

export function headingSlugs(markdown) {
  const slugs = new Set()
  const pattern = /^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm
  let match
  while ((match = pattern.exec(markdown ?? '')) !== null) {
    slugs.add(slugify(match[1]))
  }
  return slugs
}

export function headings(markdown) {
  const out = []
  const lines = (markdown ?? '').split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/)
    if (match) {
      out.push({
        level: match[1].length,
        label: match[2].trim(),
        id: slugify(match[2]),
        line: index + 1,
      })
    }
  }
  return out
}

// Heading path (ancestors + target) leading to the section with `targetId`.
export function headingPath(markdown, targetId) {
  const list = headings(markdown)
  const index = list.findIndex((heading) => heading.id === targetId)
  if (index === -1) return []
  const path = [list[index]]
  let level = list[index].level
  for (let i = index - 1; i >= 0; i -= 1) {
    if (list[i].level < level) {
      path.unshift(list[i])
      level = list[i].level
    }
  }
  return path
}

// Heading hierarchy at a given line (the section the cursor is in).
export function headingPathAtLine(markdown, line) {
  const stack = []
  for (const heading of headings(markdown)) {
    if (heading.line > line) break
    while (stack.length && stack[stack.length - 1].level >= heading.level) stack.pop()
    stack.push(heading)
  }
  return stack
}

export function resolveWikiPath(yamlFileName, linkPath) {
  if (!linkPath) return null
  if (linkPath.startsWith('/')) return linkPath.slice(1)
  const segments = (yamlFileName ?? '').split('/').slice(0, -1)
  for (const part of linkPath.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') segments.pop()
    else segments.push(part)
  }
  return segments.join('/')
}
