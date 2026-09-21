import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const YAML_EXTENSIONS = ['.yaml', '.yml']
const SEGMENT = '[A-Za-z0-9][A-Za-z0-9._-]*'
const NAME_PATTERN = new RegExp(`^${SEGMENT}(/${SEGMENT})*\\.ya?ml$`)

export function resolveObjectsDir(root, configured = process.env.OBJECTS_DIR) {
  const value = typeof configured === 'string' ? configured.trim() : ''
  if (!value) return path.resolve(root, 'objects')
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value)
}

export class ObjectsError extends Error {
  constructor(status, message, details = {}) {
    super(message)
    this.name = 'ObjectsError'
    this.status = status
    this.details = details
  }
}

export function createObjectsRepository(objectsDir) {
  const root = path.resolve(objectsDir)

  const hashOf = (content) =>
    createHash('sha256').update(content, 'utf8').digest('hex')

  function validateName(name) {
    if (typeof name !== 'string' || !NAME_PATTERN.test(name) || name.includes('..')) {
      throw new ObjectsError(400, `Invalid object file name: ${name}`)
    }
    const resolved = path.resolve(root, name)
    const relative = path.relative(root, resolved)
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new ObjectsError(400, `Invalid object file name: ${name}`)
    }
    return resolved
  }

  async function ensureDir() {
    await fs.mkdir(root, { recursive: true })
  }

  async function readFile(name) {
    const filePath = validateName(name)
    let content
    try {
      content = await fs.readFile(filePath, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new ObjectsError(404, `Object file not found: ${name}`)
      }
      throw error
    }
    const stat = await fs.stat(filePath)
    return {
      name,
      content,
      hash: hashOf(content),
      mtime: stat.mtimeMs,
    }
  }

  async function walk(directory, prefix = '') {
    const entries = await fs.readdir(directory, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        files.push(...(await walk(path.join(directory, entry.name), name)))
      } else if (YAML_EXTENSIONS.includes(path.extname(entry.name))) {
        files.push(name)
      }
    }
    return files
  }

  async function list() {
    await ensureDir()
    const files = (await walk(root)).sort((a, b) => a.localeCompare(b))
    return Promise.all(files.map((name) => readFile(name)))
  }

  async function create(name, content) {
    const filePath = validateName(name)
    if (typeof content !== 'string') {
      throw new ObjectsError(400, 'content must be a string')
    }
    await ensureDir()
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    try {
      await fs.writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' })
    } catch (error) {
      if (error.code === 'EEXIST') {
        throw new ObjectsError(409, `Object file already exists: ${name}`, {
          reason: 'exists',
        })
      }
      throw error
    }
    return readFile(name)
  }

  async function write(name, content, baseHash) {
    if (typeof content !== 'string') {
      throw new ObjectsError(400, 'content must be a string')
    }
    const current = await readFile(name)
    if (baseHash && baseHash !== current.hash) {
      throw new ObjectsError(409, `Object file changed on disk: ${name}`, {
        reason: 'conflict',
        currentHash: current.hash,
        currentContent: current.content,
      })
    }
    const filePath = validateName(name)
    await fs.writeFile(filePath, content, 'utf8')
    return readFile(name)
  }

  async function remove(name, baseHash) {
    const current = await readFile(name)
    if (baseHash && baseHash !== current.hash) {
      throw new ObjectsError(409, `Object file changed on disk: ${name}`, {
        reason: 'conflict',
        currentHash: current.hash,
        currentContent: current.content,
      })
    }
    await fs.unlink(validateName(name))
  }

  async function rename(name, to, content) {
    if (typeof content !== 'string') {
      throw new ObjectsError(400, 'content must be a string')
    }
    const fromPath = validateName(name)
    const toPath = validateName(to)
    await readFile(name)
    if (fromPath === toPath) {
      return write(name, content)
    }
    await fs.mkdir(path.dirname(toPath), { recursive: true })
    try {
      await fs.writeFile(toPath, content, { encoding: 'utf8', flag: 'wx' })
    } catch (error) {
      if (error.code === 'EEXIST') {
        throw new ObjectsError(409, `Object file already exists: ${to}`)
      }
      throw error
    }
    await fs.unlink(fromPath)
    return readFile(to)
  }

  return { root, list, read: readFile, create, write, remove, rename, hashOf, validateName }
}
