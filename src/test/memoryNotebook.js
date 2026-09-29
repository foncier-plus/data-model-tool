function notFound(message) {
  const error = new Error(message)
  error.name = 'NotFoundError'
  return error
}

function fileHandle(node) {
  return {
    kind: 'file',
    name: node.name,
    async getFile() {
      const content = node.content
      if (content && typeof content === 'object' && typeof content.text === 'function') return content
      return {
        text: async () => String(content ?? ''),
        arrayBuffer: async () => new TextEncoder().encode(String(content ?? '')).buffer,
      }
    },
    async createWritable() {
      let buffer = ''
      return {
        async write(data) {
          if (typeof data === 'string') buffer += data
          else if (data && typeof data.text === 'function') buffer += await data.text()
          else buffer += String(data)
        },
        async close() {
          node.content = buffer
        },
      }
    },
  }
}

function dirHandle(node) {
  return {
    kind: 'directory',
    name: node.name,
    async getDirectoryHandle(name, { create = false } = {}) {
      const existing = node.children.get(name)
      if (existing) {
        if (existing.kind !== 'directory') throw new Error(`${name} n'est pas un dossier`)
        return dirHandle(existing)
      }
      if (!create) throw notFound(name)
      const child = { kind: 'directory', name, children: new Map() }
      node.children.set(name, child)
      return dirHandle(child)
    },
    async getFileHandle(name, { create = false } = {}) {
      const existing = node.children.get(name)
      if (existing) {
        if (existing.kind !== 'file') throw new Error(`${name} n'est pas un fichier`)
        return fileHandle(existing)
      }
      if (!create) throw notFound(name)
      const child = { kind: 'file', name, content: '' }
      node.children.set(name, child)
      return fileHandle(child)
    },
    async removeEntry(name, { recursive = false } = {}) {
      const existing = node.children.get(name)
      if (!existing) throw notFound(name)
      if (existing.kind === 'directory' && !recursive && existing.children.size > 0) {
        throw new Error('Dossier non vide')
      }
      node.children.delete(name)
    },
    async *entries() {
      for (const [name, child] of node.children) {
        yield [name, child.kind === 'directory' ? dirHandle(child) : fileHandle(child)]
      }
    },
    async queryPermission() {
      return 'granted'
    },
    async requestPermission() {
      return 'granted'
    },
  }
}

export function createMemoryNotebook(files = {}) {
  const root = { kind: 'directory', name: 'notebook', children: new Map() }
  for (const [path, content] of Object.entries(files)) {
    const segments = path.split('/').filter(Boolean)
    const fileName = segments.pop()
    let node = root
    for (const segment of segments) {
      if (!node.children.has(segment)) {
        node.children.set(segment, { kind: 'directory', name: segment, children: new Map() })
      }
      node = node.children.get(segment)
    }
    node.children.set(fileName, { kind: 'file', name: fileName, content })
  }
  return dirHandle(root)
}
