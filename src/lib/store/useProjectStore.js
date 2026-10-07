import { create } from 'zustand'
import { toast } from 'sonner'
import {
  attributeRef,
  buildIndex,
  groupRef,
  resolveRef,
} from '@/lib/model/refs.js'
import { entryIdentity, normalizeNamespace, parseObjectDocument, parseObjectFile } from '@/lib/model/parse.js'
import { headingPath, headingSlugs, resolveWikiPath, slugify } from '@/lib/model/wiki.js'
import { findEntryByObjectName } from '@/lib/selection.js'
import { blankObjectFile, blankProjectFile, serializeObjects } from '@/lib/model/serialize.js'
import {
  addAttribute,
  addGroup,
  moveAttribute,
  moveGroup,
  removeAttribute,
  removeGroup,
  reorderAttribute,
  setAttributeField,
  setGroupField,
  setObjectField,
} from '@/lib/model/mutations.js'
import * as fs from '@/lib/fs/notebook.js'
import { documentSessionBridge } from '@/lib/documentSessionBridge.js'
import { hashText } from '@/lib/fs/hash.js'
import { ensurePermission } from '@/lib/fs/picker.js'
import { clearHandle, loadHandle, saveHandle } from '@/lib/fs/handleStore.js'

const SAVE_DELAY = 500
const saveTimers = new Map()

function loadLanguage() {
  try {
    return window.localStorage.getItem('data-flow.language') === 'en' ? 'en' : 'fr'
  } catch {
    return 'fr'
  }
}

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
    const content = serializeObjects(file.docs)
    const files = get().files.map((item) =>
      item.fileName === file.fileName ? { ...item, entries, content, dirty: true } : item,
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
    anchor: null,
    reveal: null,
    docRevision: 0,
    selection: null,
    activeHeading: null,
    docTarget: null,
    editorOpen: false,
    panelTab: 'edit',
    language: loadLanguage(),
    status: 'idle',
    message: null,
    conflict: null,

    initNotebook: async () => {
      const stored = await loadHandle().catch(() => null)
      if (!stored) return false
      if (await ensurePermission(stored, 'readwrite', { request: false })) {
        set({ handle: stored })
        const ok = await loadNotebook(stored)
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
        set({ activeFile: null, selection: null })
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

    select: (selection) => {
      // Selecting an element opens the editor on its owning file and reveals
      // the element; the main opened file must not change.
      if (!selection) {
        set({ selection: null, docTarget: null })
        return
      }
      set({ selection, docTarget: null })
      const entry = findEntryByObjectName(get().entries, selection.objectName)
      if (!entry) return
      const line = lineForSelection(entry, selection)
      revealNonce += 1
      set({
        anchor: null,
        reveal: { fileName: entry.fileName, line: line ?? null, token: revealNonce },
      })
    },
    revealSelection: (selection) => get().select(selection),
    clearSelection: () => set({ selection: null }),
    setActiveHeading: (activeHeading) => set({ activeHeading }),
    setDocTargetHeadings: (headings) => {
      const target = get().docTarget
      if (!target) return
      set({ docTarget: { ...target, headings } })
    },
    scrollToHeading: (path, id, line = null) => {
      revealNonce += 1
      set({
        anchor: { path, id },
        activeHeading: id,
        reveal: { fileName: path, line, token: revealNonce },
      })
    },
    setEditorOpen: (editorOpen) => set({ editorOpen }),
    toggleEditor: () => set((state) => ({ editorOpen: !state.editorOpen })),
    setPanelTab: (panelTab) => set({ panelTab }),
    setLanguage: (language) => {
      const next = language === 'en' ? 'en' : 'fr'
      try {
        window.localStorage.setItem('data-flow.language', next)
      } catch {
        // ignore (private mode / quota)
      }
      set({ language: next })
    },
    openFile: (activeFile) => {
      const first = get().entries.find((entry) => entry.fileName === activeFile)
      set({
        activeFile,
        anchor: null,
        reveal: null,
        activeHeading: null,
        docTarget: null,
        selection: first ? toSelection('object', first.qualifiedName) : null,
      })
    },
    openWikiLink: async (yamlFileName, path, section = '') => {
      const resolved = resolveWikiPath(yamlFileName, path)
      if (!resolved) return

      const initialRevision = get().docRevision
      let revision = initialRevision
      let content = ''
      try {
        const exists = await fs.exists(get().handle, resolved)
        if (!exists) {
          const title = section || fs.baseName(resolved).replace(/\.[^.]+$/, '')
          content = section ? `## ${section}\n` : `# ${title}\n`
          await fs.writeText(get().handle, resolved, content)
          revision += 1
        } else {
          content = await fs.readText(get().handle, resolved)
          if (section && !headingSlugs(content).has(slugify(section))) {
            const trimmed = content.replace(/\s*$/, '')
            const prefix = trimmed ? `${trimmed}\n\n` : ''
            content = `${prefix}## ${section}\n`
            await fs.writeText(get().handle, resolved, content)
            revision += 1
          }
        }
      } catch (error) {
        toast.error(error.message)
      }

      // Opening documentation must not move the main document: the markdown is
      // shown as a secondary target (breadcrumb + editor).
      const targetPath = section ? headingPath(content, slugify(section)) : []
      const line = targetPath.length ? targetPath[targetPath.length - 1].line : 1
      revealNonce += 1
      set({
        docTarget: {
          fileName: resolved,
          label: fs.baseName(resolved),
          headings: targetPath,
        },
        reveal: { fileName: resolved, line, token: revealNonce },
        anchor: section ? { path: resolved, id: slugify(section) } : null,
        selection: null,
        editorOpen: true,
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

    saveDocument: async (path, content, expected) => {
      try {
        if (expected !== undefined) {
          const disk = await fs.readText(handle(), path).catch(() => null)
          if (disk !== null && disk !== expected) {
            set({
              status: 'error',
              conflict: {
                fileName: path,
                currentContent: disk,
                currentHash: hashText(disk),
                content,
              },
            })
            return false
          }
        }
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

    moveGroup: (entryId, fromIndex, toIndex) => {
      if (fromIndex === toIndex) return
      applyToDoc(entryId, (doc) => moveGroup(doc, fromIndex, toIndex))
    },

    addAttribute: (entryId, groupIndex = null, name) => {
      let createdIndex = null
      applyToDoc(entryId, (doc) => {
        createdIndex = addAttribute(doc, groupIndex, name)
      })
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
      const entry = findEntry(get().entries, entryId)
      const model = entry?.model
      const sourceGroup = groupIndex === null ? null : model?.groups?.[groupIndex]
      const attribute = sourceGroup
        ? sourceGroup.attributes?.[attributeIndex]
        : model?.attributes?.[attributeIndex]
      const name = attribute?.name
      applyToDoc(entryId, (doc) =>
        moveAttribute(doc, groupIndex, attributeIndex, toGroupIndex),
      )
      if (!name) return
      // Moving an attribute must not open its editor: stay in the parent
      // element. Only remap when the moved attribute itself was selected.
      const selection = get().selection
      if (
        selection &&
        selection.kind === 'attribute' &&
        selection.objectName === entryId &&
        selection.groupName === (sourceGroup?.name ?? null) &&
        selection.attributeName === name
      ) {
        set({
          selection: sourceGroup
            ? toSelection('group', entryId, sourceGroup.name)
            : toSelection('object', entryId),
        })
      }
    },

    reorderAttribute: (entryId, groupIndex, fromIndex, toIndex) => {
      if (fromIndex === toIndex) return
      applyToDoc(entryId, (doc) => reorderAttribute(doc, groupIndex, fromIndex, toIndex))
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
      const fileName = fs.joinPath(
        dirPath,
        name.endsWith('.object.yaml') ? name : `${name}.object.yaml`,
      )
      if (await fs.exists(handle(), fileName)) {
        toast.error(`Le fichier ${fileName} existe déjà.`)
        return null
      }
      await fs.writeText(handle(), fileName, blankObjectFile(name, normalized))
      await get().refresh()
      set({
        activeFile: fileName,
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
      set({ activeFile: fileName })
      return fileName
    },

    createFolder: async (dirPath, name) => {
      await fs.createDirectory(handle(), fs.joinPath(dirPath, name))
      await get().refresh()
    },

    createProject: async (dirPath, name) => {
      const fileName = fs.joinPath(
        dirPath,
        name.endsWith('.project.yaml') ? name : `${name}.project.yaml`,
      )
      if (await fs.exists(handle(), fileName)) {
        toast.error(`Le fichier ${fileName} existe déjà.`)
        return null
      }
      await fs.writeText(handle(), fileName, blankProjectFile(name))
      await get().refresh()
      set({ activeFile: fileName })
      return fileName
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
      const isObjectFile = get().files.some((item) => item.fileName === conflict.fileName)
      if (!isObjectFile) {
        documentSessionBridge.reload?.(conflict.fileName, conflict.currentContent)
        set({ conflict: null, status: 'saved' })
        return
      }
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
      documentSessionBridge.reload?.(conflict.fileName, conflict.content)
      await get().refresh()
      set({ status: 'saved' })
    },

    dismissConflict: () => set({ conflict: null, status: 'idle', message: null }),

    getIndex: () => buildIndex(get().entries),
  }
})
