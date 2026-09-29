import { classifyFile, isHidden } from './documentType.js'

export function splitPath(path) {
  return path ? path.split('/').filter(Boolean) : []
}

export function joinPath(...parts) {
  return parts.flatMap((part) => splitPath(part)).join('/')
}

export function dirName(path) {
  const parts = splitPath(path)
  parts.pop()
  return parts.join('/')
}

export function baseName(path) {
  return splitPath(path).pop() ?? ''
}

async function resolveDirectory(root, segments, { create }) {
  let handle = root
  for (const segment of segments) {
    handle = await handle.getDirectoryHandle(segment, { create })
  }
  return handle
}

export async function getDirectoryHandle(root, path = '', { create = false } = {}) {
  return resolveDirectory(root, splitPath(path), { create })
}

export async function getFileHandle(root, path, { create = false } = {}) {
  const segments = splitPath(path)
  const name = segments.pop()
  if (!name) throw new Error(`Chemin de fichier invalide : ${path}`)
  const parent = await resolveDirectory(root, segments, { create })
  return parent.getFileHandle(name, { create })
}

export async function getEntryHandle(root, path) {
  const segments = splitPath(path)
  const name = segments.pop()
  if (!name) throw new Error(`Chemin invalide : ${path}`)
  const parent = await resolveDirectory(root, segments, { create: false })
  try {
    return await parent.getFileHandle(name)
  } catch {
    return parent.getDirectoryHandle(name)
  }
}

async function walk(directory, path) {
  const children = []
  for await (const [name, handle] of directory.entries()) {
    if (isHidden(name)) continue
    const childPath = joinPath(path, name)
    if (handle.kind === 'directory') {
      children.push(await walk(handle, childPath))
      continue
    }
    const type = classifyFile(name)
    if (type === 'other') continue
    children.push({ kind: 'file', name, path: childPath, type })
  }
  children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return { kind: 'directory', name: baseName(path) || 'notebook', path, children }
}

export async function readTree(root) {
  return walk(root, '')
}

export async function readText(root, path) {
  const handle = await getFileHandle(root, path)
  const file = await handle.getFile()
  return file.text()
}

export async function readBlob(root, path) {
  const handle = await getFileHandle(root, path)
  return handle.getFile()
}

export async function writeText(root, path, content) {
  const handle = await getFileHandle(root, path, { create: true })
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
}

export async function createFile(root, path, content = '') {
  await writeText(root, path, content)
  return path
}

export async function createDirectory(root, path) {
  await getDirectoryHandle(root, path, { create: true })
  return path
}

export async function exists(root, path) {
  try {
    await getEntryHandle(root, path)
    return true
  } catch {
    return false
  }
}

export async function removeEntry(root, path) {
  const segments = splitPath(path)
  const name = segments.pop()
  const parent = await resolveDirectory(root, segments, { create: false })
  await parent.removeEntry(name, { recursive: true })
}

async function copyEntry(source, targetParent, name) {
  if (source.kind === 'directory') {
    const created = await targetParent.getDirectoryHandle(name, { create: true })
    for await (const [childName, childHandle] of source.entries()) {
      await copyEntry(childHandle, created, childName)
    }
    return
  }
  const file = await source.getFile()
  const created = await targetParent.getFileHandle(name, { create: true })
  const writable = await created.createWritable()
  await writable.write(file)
  await writable.close()
}

export async function importEntry(root, targetDirPath, sourceHandle) {
  const targetParent = await getDirectoryHandle(root, targetDirPath, { create: true })
  await copyEntry(sourceHandle, targetParent, sourceHandle.name)
  return joinPath(targetDirPath, sourceHandle.name)
}

export async function renameEntry(root, fromPath, toPath) {
  if (fromPath === toPath) return toPath
  const source = await getEntryHandle(root, fromPath)
  const targetSegments = splitPath(toPath)
  const newName = targetSegments.pop()
  const targetParent = await resolveDirectory(root, targetSegments, { create: true })
  if (typeof source.move === 'function') {
    await source.move(targetParent, newName)
    return toPath
  }
  await copyEntry(source, targetParent, newName)
  await removeEntry(root, fromPath)
  return toPath
}

export async function moveEntry(root, fromPath, toDirPath) {
  const targetPath = joinPath(toDirPath, baseName(fromPath))
  if (targetPath === fromPath) return fromPath
  if (fromPath && (toDirPath === fromPath || toDirPath.startsWith(`${fromPath}/`))) {
    throw new Error('Impossible de déplacer un dossier dans lui-même.')
  }
  return renameEntry(root, fromPath, targetPath)
}
