import { create } from 'zustand'
import { toast } from 'sonner'
import {
  attributeRef,
  buildIndex,
  groupRef,
  resolveRef,
} from '@/lib/model/refs.js'
import { entryIdentity, normalizeNamespace, parseObjectDocument, parseObjectFile } from '@/lib/model/parse.js'
import { headingSlugs, resolveWikiPath, slugify } from '@/lib/model/wiki.js'
import { findEntryByObjectName } from '@/lib/selection.js'
import { blankObjectFile, serializeObjects } from '@/lib/model/serialize.js'
import {
  addAttribute,
  addGroup,
  moveAttribute,
  removeAttribute,
  removeGroup,
  setAttributeField,
  setGroupField,
  setObjectField,
} from '@/lib/model/mutations.js'
import * as fs from '@/lib/fs/notebook.js'
import { hashText } from '@/lib/fs/hash.js'
import { ensurePermission } from '@/lib/fs/picker.js'
import { clearHandle, loadHandle, saveHandle } from '@/lib/fs/handleStore.js'

const SAVE_DELAY = 500
const saveTimers = new Map()

function collectYamlPaths(node, paths = []) {
  for (const child of node.children ?? []) {
    if (child.kind === 'directory') collectYamlPaths(child, paths)
    else if (child.type === 'yaml') paths.push(child.path)
  }
  return paths
}

function findEntry(entries, id) {
  return entries.find((entry) => entry.qualifiedName === id) ?? null
}

function lineForSelection(entry, selection) {
  const lines = entry?.lines
  if (!lines || !selection) return null
  if (selection.kind === 'object') return lines.object ?? null
  if (selection.kind === 'group') return lines.groups?.[selection.groupName] ?? null
  if (selection.kind === 'attribute') {
    if (selection.groupName) {
      return lines.groupAttributes?.[`${selection.groupName}.${selection.attributeName}`] ?? null
    }
    return lines.attributes?.[selection.attributeName] ?? null
  }
  return null
}

let revealNonce = 0

function toFileRecord(fileName, content) {
  const parsed = parseObjectFile(fileName, content)
  return {
    fileName,
    content,
    hash: hashText(content),
    docs: parsed.docs,
    entries: parsed.entries,
    dirty: false,
  }
}

function toSelection(kind, objectName, groupName = null, attributeName = null) {
  if (kind === 'attribute') {
    return {
      kind,
      objectName,
      groupName,
      attributeName,
      ref: attributeRef(objectName, groupName, attributeName),
    }
  }
  if (kind === 'group') {
    return { kind, objectName, groupName, attributeName: null, ref: groupRef(objectName, groupName) }
  }
  return { kind: 'object', objectName, groupName: null, attributeName: null, ref: objectName }
}

export const useProjectStore = create((set, get) => {
  const handle = () => get().handle

  function remapSelection(previousId, nextId) {
    if (!previousId || previousId === nextId) return
    const selection = get().selection
    if (!selection || selection.objectName !== previousId) return
    set({
      selection: toSelection(selection.kind, nextId, selection.groupName, selection.attributeName),
    })
  }

  async function loadNotebook(directoryHandle) {
    set({ status: 'loading', message: null, conflict: null })
    try {
      const tree = await fs.readTree(directoryHandle)
      const paths = collectYamlPaths(tree)
      const files = []
      for (const fileName of paths) {
        const content = await fs.readText(directoryHandle, fileName)
        files.push(toFileRecord(fileName, content))
      }
      const entries = files.flatMap((file) => file.entries)
      const current = get().selection
      const selection =
        current && findEntry(entries, current.objectName) ? current : null
      let markdownCss = ''
      try {
        if (await fs.exists(directoryHandle, 'markdown.css')) {
          markdownCss = await fs.readText(directoryHandle, 'markdown.css')
        }
      } catch {
        markdownCss = ''
      }
      set({
        handle: directoryHandle,
        notebookName: directoryHandle.name ?? 'notebook',
        tree,
        files,
        entries,
        selection,
        markdownCss,
        status: 'idle',
        message: null,
      })
      return true
    } catch (error) {
      set({ status: 'error', message: error.message })
      toast.error(error.message)
      return false
    }
  }

  function scheduleSave(fileName) {
    const existing = saveTimers.get(fileName)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      saveTimers.delete(fileName)
      get().flush(fileName)
    }, SAVE_DELAY)
    saveTimers.set(fileName, timer)
  }

  function applyToDoc(entryId, mutator) {
    const entry = findEntry(get().entries, entryId)
    if (!entry) return false
    const file = get().files.find((item) => item.fileName === entry.fileName)
    if (!file) return false
    mutator(entry.doc)
    const entries = file.docs.map((doc, docIndex) =>
      parseObjectDocument(file.fileName, doc, docIndex),
    )
    const files = get().files.map((item) =>
      item.fileName === file.fileName ? { ...item, entries, dirty: true } : item,
    )
    set({
      files,
      entries: files.flatMap((item) => item.entries),
      status: 'saving',
      message: null,
    })
    scheduleSave(file.fileName)
    return true
  }

  return {
    handle: null,
    pendingHandle: null,
    notebookName: null,
    tree: null,
    files: [],
    entries: [],
    markdownCss: '',
    activeFile: null,
    activeView: 'data-model',
    anchor: null,
    reveal: null,
    docRevision: 0,
    selection: null,
    panelTab: 'edit',
    status: 'idle',
    message: null,
    conflict: null,

    initNotebook: async () => {
      const stored = await loadHandle().catch(() => null)
      if (!stored) return false
      if (await ensurePermission(stored, 'readwrite', { request: false })) {
        set({ handle: stored })
        const ok = await loadNotebook(stored)
        if (ok) set({ activeView: 'data-model' })
        return ok
      }
      set({ pendingHandle: stored })
      return false
    },

    openNotebook: async (directoryHandle, { request = true } = {}) => {
      const granted = await ensurePermission(directoryHandle, 'readwrite', { request })
      if (!granted) {
        set({ status: 'error', message: 'Permission refusée pour ce dossier.' })
        return false
      }
      set({ handle: directoryHandle, pendingHandle: null })
      const ok = await loadNotebook(directoryHandle)
      if (ok) {
        await saveHandle(directoryHandle)
        set({ activeView: 'data-model', activeFile: null, selection: null })
      }
      return ok
    },

    closeNotebook: async () => {
      await clearHandle().catch(() => null)
      for (const timer of saveTimers.values()) clearTimeout(timer)
      saveTimers.clear()
      set({
        handle: null,
        pendingHandle: null,
        notebookName: null,
        tree: null,
        files: [],
        entries: [],
        markdownCss: '',
        activeFile: null,
        activeView: 'data-model',
        selection: null,
        status: 'idle',
        message: null,
        conflict: null,
      })
    },

    refresh: async () => {
      if (!handle()) return
      await loadNotebook(handle())
    },

    select: (selection) => set({ selection }),
    revealSelection: (selection) => {
      set({ selection })
      const entry = findEntryByObjectName(get().entries, selection?.objectName)
      if (!entry) return
      const line = lineForSelection(entry, selection)
      revealNonce += 1
      set({
        activeFile: entry.fileName,
        activeView: 'documentation',
        anchor: null,
        reveal: { fileName: entry.fileName, line: line ?? null, token: revealNonce },
      })
    },
    clearSelection: () => set({ selection: null }),
    setPanelTab: (panelTab) => set({ panelTab }),
    setActiveView: (activeView) => set({ activeView }),
    openFile: (activeFile) => set({ activeFile, activeView: 'documentation', anchor: null, reveal: null }),
    openWikiLink: async (yamlFileName, path, section = '') => {
      const resolved = resolveWikiPath(yamlFileName, path)
      if (!resolved) return

      const initialRevision = get().docRevision
      let revision = initialRevision
      try {
        const exists = await fs.exists(get().handle, resolved)
        if (!exists) {
          const title = section || fs.baseName(resolved).replace(/\.[^.]+$/, '')
          const content = section ? `## ${section}\n` : `# ${title}\n`
          await fs.writeText(get().handle, resolved, content)
          revision += 1
        } else if (section) {
          const content = await fs.readText(get().handle, resolved)
          if (!headingSlugs(content).has(slugify(section))) {
            const trimmed = content.replace(/\s*$/, '')
            const prefix = trimmed ? `${trimmed}\n\n` : ''
            await fs.writeText(get().handle, resolved, `${prefix}## ${section}\n`)
            revision += 1
          }
        }
      } catch (error) {
        toast.error(error.message)
      }

      set({
        activeFile: resolved,
        activeView: 'documentation',
        anchor: section ? { path: resolved, id: slugify(section) } : null,
        reveal: null,
        docRevision: revision,
      })

      if (revision !== initialRevision) await get().refresh()
    },

    flush: async (fileName) => {
      const current = get()
      const file = current.files.find((item) => item.fileName === fileName)
      if (!file || !file.dirty || !current.handle) return
      const content = serializeObjects(file.docs)
      set({ status: 'saving', message: null })
      try {
        const disk = await fs.readText(current.handle, fileName).catch(() => null)
        if (disk !== null && hashText(disk) !== file.hash) {
          set({
            status: 'error',
            conflict: {
              fileName,
              currentContent: disk,
              currentHash: hashText(disk),
              content,
            },
          })
          return
        }
        await fs.writeText(current.handle, fileName, content)
        set((state) => ({
          files: state.files.map((item) =>
            item.fileName === fileName
              ? { ...item, content, hash: hashText(content), dirty: false }
              : item,
          ),
          status: 'saved',
        }))
      } catch (error) {
        set({ status: 'error', message: error.message })
        toast.error(error.message)
      }
    },

    applySource: (fileName, text) => {
      const file = get().files.find((item) => item.fileName === fileName)
      if (!file) return { ok: false, errors: [`Fichier inconnu : ${fileName}`] }
      const parsed = parseObjectFile(fileName, text)
      const syntaxErrors = parsed.docs.flatMap((doc) =>
        doc.errors.map((error) => error.message),
      )
      if (syntaxErrors.length > 0) return { ok: false, errors: syntaxErrors }
      const next = { ...file, content: text, docs: parsed.docs, entries: parsed.entries, dirty: true }
      const files = get().files.map((item) => (item.fileName === fileName ? next : item))
      set({ files, entries: files.flatMap((item) => item.entries), status: 'saving' })
      scheduleSave(fileName)
      return { ok: true, errors: [] }
    },

    readDocument: (path) => fs.readText(handle(), path),
    readBlob: (path) => fs.readBlob(handle(), path),

    saveDocument: async (path, content) => {
      try {
        await fs.writeText(handle(), path, content)
        set({ status: 'saved' })
        return true
      } catch (error) {
        set({ status: 'error', message: error.message })
        toast.error(error.message)
        return false
      }
    },

    setMarkdownCss: (markdownCss) => set({ markdownCss: markdownCss ?? '' }),

    saveMarkdownCss: async (content) => {
      try {
        const existed = await fs.exists(handle(), 'markdown.css')
        await fs.writeText(handle(), 'markdown.css', content ?? '')
        set({ markdownCss: content ?? '', status: 'saved' })
        if (!existed) await get().refresh()
        return true
      } catch (error) {
        set({ status: 'error', message: error.message })
        toast.error(error.message)
        return false
      }
    },

    setObjectField: (entryId, key, value) => {
      const entry = findEntry(get().entries, entryId)
      const ok = applyToDoc(entryId, (doc) => setObjectField(doc, key, value))
      if (ok && entry && (key === 'name' || key === 'namespace')) {
        remapSelection(
          entryId,
          entryIdentity(
            key === 'namespace' ? value : entry.namespace,
            key === 'name' ? value : entry.model?.name,
          ),
        )
      }
      return ok
    },
    setGroupField: (entryId, groupIndex, key, value) =>
      applyToDoc(entryId, (doc) => setGroupField(doc, groupIndex, key, value)),
    setAttributeField: (entryId, groupIndex, attributeIndex, key, value) =>
      applyToDoc(entryId, (doc) =>
        setAttributeField(doc, groupIndex, attributeIndex, key, value),
      ),

    renameObject: (entryId, newName) => get().setObjectField(entryId, 'name', newName),

    deleteEntry: async (entryId) => {
      const entry = findEntry(get().entries, entryId)
      if (!entry) return
      const file = get().files.find((item) => item.fileName === entry.fileName)
      if (!file) return
      if (file.docs.length <= 1) {
        await get().deletePath(file.fileName)
        return
      }
      file.docs.splice(entry.docIndex, 1)
      const entries = file.docs.map((doc, docIndex) =>
        parseObjectDocument(file.fileName, doc, docIndex),
      )
      const files = get().files.map((item) =>
        item.fileName === file.fileName ? { ...item, entries, dirty: true } : item,
      )
      set({
        files,
        entries: files.flatMap((item) => item.entries),
        selection: get().selection?.objectName === entryId ? null : get().selection,
        status: 'saving',
      })
      scheduleSave(file.fileName)
    },

    addGroup: (entryId, name) => {
      let createdIndex = null
      applyToDoc(entryId, (doc) => {
        createdIndex = addGroup(doc, name)
      })
      const entry = findEntry(get().entries, entryId)
      const group = createdIndex === null ? null : entry?.model?.groups?.[createdIndex]
      if (entry && group) set({ selection: toSelection('group', entryId, group.name) })
      return createdIndex
    },

    removeGroup: (entryId, groupIndex) => {
      const entry = findEntry(get().entries, entryId)
      const removed = entry?.model?.groups?.[groupIndex]?.name
      applyToDoc(entryId, (doc) => removeGroup(doc, groupIndex))
      const selection = get().selection
      if (selection && selection.objectName === entryId && selection.groupName === removed) {
        set({ selection: toSelection('object', entryId) })
      }
    },

    addAttribute: (entryId, groupIndex = null, name) => {
      let createdIndex = null
      applyToDoc(entryId, (doc) => {
        createdIndex = addAttribute(doc, groupIndex, name)
      })
      const entry = findEntry(get().entries, entryId)
      if (entry?.model && createdIndex !== null) {
        const group = groupIndex === null ? null : entry.model.groups?.[groupIndex]
        const createdName = group
          ? group.attributes?.[createdIndex]?.name
          : entry.model.attributes?.[createdIndex]?.name
        if (createdName) {
          set({ selection: toSelection('attribute', entryId, group?.name ?? null, createdName) })
        }
      }
      return createdIndex
    },

    removeAttribute: (entryId, groupIndex, attributeIndex) => {
      const entry = findEntry(get().entries, entryId)
      const group = groupIndex === null ? null : entry?.model?.groups?.[groupIndex]
      const removedName = group
        ? group?.attributes?.[attributeIndex]?.name
        : entry?.model?.attributes?.[attributeIndex]?.name
      applyToDoc(entryId, (doc) => removeAttribute(doc, groupIndex, attributeIndex))
      const selection = get().selection
      if (
        selection &&
        selection.kind === 'attribute' &&
        selection.objectName === entryId &&
        selection.groupName === (group?.name ?? null) &&
        selection.attributeName === removedName
      ) {
        set({ selection: toSelection('object', entryId) })
      }
    },

    moveAttribute: (entryId, groupIndex, attributeIndex, toGroupIndex) => {
      applyToDoc(entryId, (doc) =>
        moveAttribute(doc, groupIndex, attributeIndex, toGroupIndex),
      )
    },

    moveAttributeToGroup: (entryId, groupIndex, attributeIndex, targetGroupName) => {
      const entry = findEntry(get().entries, entryId)
      const model = entry?.model
      if (!model) return
      const group = groupIndex === null ? null : model.groups?.[groupIndex]
      const attribute = group
        ? group.attributes?.[attributeIndex]
        : model.attributes?.[attributeIndex]
      if (!attribute) return
      const name = (targetGroupName ?? '').trim()
      const existing = name ? model.groups.findIndex((item) => item.name === name) : -1
      let targetIndex = existing >= 0 ? existing : null
      applyToDoc(entryId, (doc) => {
        if (name && targetIndex === null) targetIndex = addGroup(doc, name)
        moveAttribute(doc, groupIndex, attributeIndex, name ? targetIndex : null)
      })
      const updated = findEntry(get().entries, entryId)
      const targetGroup = targetIndex === null ? null : updated?.model?.groups?.[targetIndex]
      if (updated?.model) {
        set({
          selection: toSelection('attribute', entryId, targetGroup?.name ?? null, attribute.name),
        })
      }
    },

    linkAttributes: (sourceRef, targetRef) => {
      if (!sourceRef || !targetRef || sourceRef === targetRef) return
      const entries = get().entries
      const index = buildIndex(entries)
      const source = resolveRef(sourceRef, index)
      const target = resolveRef(targetRef, index)
      if (source?.kind !== 'attribute' || target?.kind !== 'attribute') return
      const entry = findEntry(entries, target.objectName)
      if (!entry?.model) return
      const model = entry.model
      let groupIndex = null
      if (target.groupName) {
        groupIndex = model.groups.findIndex((group) => group.name === target.groupName)
        if (groupIndex < 0) return
      }
      const list = groupIndex === null ? model.attributes : model.groups[groupIndex].attributes
      const attributeIndex = (list ?? []).findIndex((item) => item.name === target.attributeName)
      if (attributeIndex < 0) return
      const attribute = list[attributeIndex]
      const from = attribute.origin?.from ?? []
      if (from.includes(source.ref)) return
      applyToDoc(entry.qualifiedName, (doc) =>
        setAttributeField(doc, groupIndex, attributeIndex, 'origin', {
          from: [...from, source.ref],
          formula: attribute.origin?.formula ?? '',
        }),
      )
    },

    createObject: async (dirPath, name, namespace = '') => {
      const normalized = normalizeNamespace(namespace)
      const fileName = fs.joinPath(dirPath, `${name}.yaml`)
      if (await fs.exists(handle(), fileName)) {
        toast.error(`Le fichier ${fileName} existe déjà.`)
        return null
      }
      await fs.writeText(handle(), fileName, blankObjectFile(name, normalized))
      await get().refresh()
      set({
        activeFile: fileName,
        activeView: 'documentation',
        selection: toSelection('object', entryIdentity(normalized, name)),
      })
      return fileName
    },

    createDocument: async (dirPath, name, type) => {
      const extension = type === 'markdown' ? '.md' : '.md'
      const fileName = fs.joinPath(dirPath, name.endsWith(extension) ? name : `${name}${extension}`)
      if (await fs.exists(handle(), fileName)) {
        toast.error(`Le fichier ${fileName} existe déjà.`)
        return null
      }
      await fs.writeText(handle(), fileName, `# ${name}\n`)
      await get().refresh()
      set({ activeFile: fileName, activeView: 'documentation' })
      return fileName
    },

    createFolder: async (dirPath, name) => {
      await fs.createDirectory(handle(), fs.joinPath(dirPath, name))
      await get().refresh()
    },

    renamePath: async (path, newName) => {
      const target = fs.joinPath(fs.dirName(path), newName)
      try {
        await fs.renameEntry(handle(), path, target)
        await get().refresh()
        set((state) => ({
          activeFile: state.activeFile === path ? target : state.activeFile,
        }))
        return true
      } catch (error) {
        toast.error(error.message)
        return false
      }
    },

    movePath: async (fromPath, toDirPath) => {
      try {
        await fs.moveEntry(handle(), fromPath, toDirPath)
        await get().refresh()
        return true
      } catch (error) {
        toast.error(error.message)
        return false
      }
    },

    deletePath: async (path) => {
      try {
        await fs.removeEntry(handle(), path)
        await get().refresh()
        set((state) => ({
          activeFile: state.activeFile === path ? null : state.activeFile,
        }))
        return true
      } catch (error) {
        toast.error(error.message)
        return false
      }
    },

    importHandles: async (dirPath, handles) => {
      for (const sourceHandle of handles) {
        await fs.importEntry(handle(), dirPath, sourceHandle)
      }
      await get().refresh()
    },

    resolveConflictReload: async () => {
      const conflict = get().conflict
      if (!conflict) return
      const file = toFileRecord(conflict.fileName, conflict.currentContent)
      set((state) => {
        const files = state.files.map((item) =>
          item.fileName === conflict.fileName ? file : item,
        )
        return {
          files,
          entries: files.flatMap((item) => item.entries),
          conflict: null,
          status: 'saved',
        }
      })
    },

    resolveConflictOverwrite: async () => {
      const conflict = get().conflict
      if (!conflict) return
      set({ conflict: null, status: 'saving' })
      await fs.writeText(get().handle, conflict.fileName, conflict.content)
      await get().refresh()
      set({ status: 'saved' })
    },

    dismissConflict: () => set({ conflict: null, status: 'idle', message: null }),

    getIndex: () => buildIndex(get().entries),
  }
})
