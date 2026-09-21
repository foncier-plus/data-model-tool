import YAML from 'yaml'
import { create } from 'zustand'
import { api } from '@/lib/api.js'
import { attributeRef, buildIndex, groupRef, resolveRef, validateReferences } from '@/lib/model/refs.js'
import { findEntryByObjectName } from '@/lib/selection.js'
import { normalizeComments } from '@/lib/model/comments.js'
import { deriveModel, parseObjectFile } from '@/lib/model/parse.js'
import { serializeObject, blankObjectFile } from '@/lib/model/serialize.js'
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

const SAVE_DELAY = 700
const SEGMENT = '[A-Za-z0-9][A-Za-z0-9._-]*'
const NAME_PATTERN = new RegExp(`^${SEGMENT}(/${SEGMENT})*$`)

const saveTimers = new Map()

function toEntry(file) {
  const filePath = file.name.replace(/\.ya?ml$/, '')
  const slash = filePath.lastIndexOf('/')
  return {
    ...parseObjectFile(file.name, file.content),
    qualifiedName: filePath.replace(/\//g, '.'),
    namespace: slash === -1 ? null : filePath.slice(0, slash).replace(/\//g, '.'),
    hash: file.hash,
    mtime: file.mtime,
    content: file.content,
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
  const findEntry = (fileName) => get().entries.find((entry) => entry.fileName === fileName)

  async function flush(fileName) {
    const entry = findEntry(fileName)
    if (!entry || !entry.dirty) return
    const content = serializeObject(entry.doc)
    set({ status: 'saving', message: null })
    try {
      const saved = await api.write(fileName, content, entry.hash)
      set((state) => ({
        entries: state.entries.map((item) =>
          item.fileName === fileName
            ? { ...item, hash: saved.hash, dirty: false, content: saved.content }
            : item,
        ),
        status: 'saved',
      }))
    } catch (error) {
      if (error.status === 409) {
        set({
          status: 'error',
          message: `Conflict on ${fileName}: file changed on disk`,
          conflict: {
            fileName,
            currentContent: error.data.currentContent,
            currentHash: error.data.currentHash,
          },
        })
        return
      }
      set({ status: 'error', message: error.message })
    }
  }

  function scheduleSave(fileName) {
    const existing = saveTimers.get(fileName)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      saveTimers.delete(fileName)
      flush(fileName)
    }, SAVE_DELAY)
    saveTimers.set(fileName, timer)
  }

  function applyMutation(fileName, mutator) {
    const entry = findEntry(fileName)
    if (!entry) return
    mutator(entry.doc)
    const { raw, model, errors } = deriveModel(entry.doc)
    set((state) => ({
      entries: state.entries.map((item) =>
        item.fileName === fileName ? { ...item, raw, model, errors, dirty: true } : item,
      ),
      status: 'saving',
      message: null,
    }))
    scheduleSave(fileName)
  }

  return {
    entries: [],
    status: 'idle',
    message: null,
    conflict: null,
    selection: null,
    panelTab: 'edit',

    select: (selection) =>
      set((state) => ({
        selection,
        panelTab:
          selection && selection.kind !== 'object' ? 'edit' : state.panelTab,
      })),
    clearSelection: () => set({ selection: null }),
    setPanelTab: (panelTab) => set({ panelTab }),

    refresh: async () => {
      set({ status: 'loading', message: null, conflict: null })
      try {
        const { objects } = await api.list()
        const entries = objects.map(toEntry)
        const index = buildIndex(entries)
        const current = get().selection
        const selection = current && resolveRef(current.ref, index) ? current : null
        set({ entries, status: 'idle', selection })
      } catch (error) {
        set({ status: 'error', message: error.message })
      }
    },

    createObject: async (name) => {
      if (!NAME_PATTERN.test(name)) {
        set({ status: 'error', message: `Invalid object name: ${name}` })
        return null
      }
      const fileName = `${name}.yaml`
      const baseName = name.slice(name.lastIndexOf('/') + 1)
      try {
        const created = await api.create(fileName, blankObjectFile(baseName))
        const entry = toEntry(created)
        set((state) => ({
          entries: [...state.entries, entry].sort((a, b) =>
            a.fileName.localeCompare(b.fileName),
          ),
          status: 'saved',
          selection: toSelection('object', entry.qualifiedName),
        }))
        return name
      } catch (error) {
        set({ status: 'error', message: error.message })
        return null
      }
    },

    deleteObject: async (fileName) => {
      const entry = findEntry(fileName)
      if (!entry) return
      try {
        await api.remove(fileName, entry.hash)
        set((state) => {
          const entries = state.entries.filter((item) => item.fileName !== fileName)
          const selection =
            state.selection?.objectName === entry.qualifiedName ? null : state.selection
          return { entries, selection, status: 'saved' }
        })
      } catch (error) {
        set({ status: 'error', message: error.message })
      }
    },

    renameObject: async (fileName, newName) => {
      if (!NAME_PATTERN.test(newName) || newName.includes('/')) {
        set({ status: 'error', message: `Invalid object name: ${newName}` })
        return false
      }
      const entry = findEntry(fileName)
      if (!entry) return false
      const slash = fileName.lastIndexOf('/')
      const dir = slash === -1 ? '' : fileName.slice(0, slash + 1)
      const to = `${dir}${newName}.yaml`
      const previousName = entry.qualifiedName
      const nextName = to.replace(/\.ya?ml$/, '').replace(/\//g, '.')
      setObjectField(entry.doc, 'name', newName)
      const { raw, model, errors } = deriveModel(entry.doc)
      const content = serializeObject(entry.doc)
      try {
        const renamed = await api.rename(fileName, to, content)
        set((state) => ({
          entries: state.entries
            .map((item) =>
              item.fileName === fileName
                ? {
                    ...item,
                    fileName: to,
                    qualifiedName: nextName,
                    doc: entry.doc,
                    raw,
                    model,
                    errors,
                    hash: renamed.hash,
                    content: renamed.content,
                    dirty: false,
                  }
                : item,
            )
            .sort((a, b) => a.fileName.localeCompare(b.fileName)),
          selection:
            state.selection?.objectName === previousName
              ? toSelection(state.selection.kind, nextName, state.selection.groupName, state.selection.attributeName)
              : state.selection,
          status: 'saved',
        }))
        return true
      } catch (error) {
        setObjectField(entry.doc, 'name', previousName)
        set({ status: 'error', message: error.message })
        return false
      }
    },

    setObjectField: (fileName, key, value) =>
      applyMutation(fileName, (doc) => setObjectField(doc, key, value)),

    addGroup: (fileName, name) => {
      let createdIndex = null
      applyMutation(fileName, (doc) => {
        createdIndex = addGroup(doc, name)
      })
      const entry = findEntry(fileName)
      const group = createdIndex === null ? null : entry?.model?.groups?.[createdIndex]
      if (entry?.qualifiedName && group) {
        set({ selection: toSelection('group', entry.qualifiedName, group.name) })
      }
      return createdIndex
    },

    removeGroup: (fileName, groupIndex) => {
      const entry = findEntry(fileName)
      const removed = entry?.model?.groups?.[groupIndex]?.name
      applyMutation(fileName, (doc) => removeGroup(doc, groupIndex))
      const selection = get().selection
      if (selection && selection.objectName === entry?.qualifiedName && selection.groupName === removed) {
        set({ selection: toSelection('object', entry.qualifiedName) })
      }
    },

    setGroupField: (fileName, groupIndex, key, value) =>
      applyMutation(fileName, (doc) => setGroupField(doc, groupIndex, key, value)),

    addAttribute: (fileName, groupIndex = null, name) => {
      let createdIndex = null
      applyMutation(fileName, (doc) => {
        createdIndex = addAttribute(doc, groupIndex, name)
      })
      const entry = findEntry(fileName)
      const objectName = entry?.qualifiedName
      if (objectName && createdIndex !== null) {
        const group = groupIndex === null ? null : entry.model.groups?.[groupIndex]
        const createdName = group
          ? group.attributes?.[createdIndex]?.name
          : entry.model.attributes?.[createdIndex]?.name
        if (createdName) {
          set({ selection: toSelection('attribute', objectName, group?.name ?? null, createdName) })
        }
      }
      return createdIndex
    },

    removeAttribute: (fileName, groupIndex, attributeIndex) => {
      const entry = findEntry(fileName)
      const group = groupIndex === null ? null : entry?.model?.groups?.[groupIndex]
      const removedName = group
        ? group?.attributes?.[attributeIndex]?.name
        : entry?.model?.attributes?.[attributeIndex]?.name
      applyMutation(fileName, (doc) => removeAttribute(doc, groupIndex, attributeIndex))
      const selection = get().selection
      if (
        selection &&
        selection.kind === 'attribute' &&
        selection.objectName === entry?.qualifiedName &&
        selection.groupName === (group?.name ?? null) &&
        selection.attributeName === removedName
      ) {
        set({ selection: toSelection('object', entry.qualifiedName) })
      }
    },

    setAttributeField: (fileName, groupIndex, attributeIndex, key, value) =>
      applyMutation(fileName, (doc) =>
        setAttributeField(doc, groupIndex, attributeIndex, key, value),
      ),

    moveAttribute: (fileName, groupIndex, attributeIndex, toGroupIndex) => {
      const entry = findEntry(fileName)
      const model = entry?.model
      if (!model) return
      const group = groupIndex === null ? null : model.groups?.[groupIndex]
      const attribute = group
        ? group.attributes?.[attributeIndex]
        : model.attributes?.[attributeIndex]
      if (!attribute) return
      applyMutation(fileName, (doc) =>
        moveAttribute(doc, groupIndex, attributeIndex, toGroupIndex),
      )
      const updated = findEntry(fileName)
      const targetGroup =
        toGroupIndex === null ? null : updated?.model?.groups?.[toGroupIndex]
      if (updated?.model) {
        set({
          selection: toSelection(
            'attribute',
            updated.qualifiedName,
            targetGroup?.name ?? null,
            attribute.name,
          ),
        })
      }
    },

    moveAttributeToGroup: (fileName, groupIndex, attributeIndex, targetGroupName) => {
      const entry = findEntry(fileName)
      const model = entry?.model
      if (!model) return
      const group = groupIndex === null ? null : model.groups?.[groupIndex]
      const attribute = group
        ? group.attributes?.[attributeIndex]
        : model.attributes?.[attributeIndex]
      if (!attribute) return
      const name = (targetGroupName ?? '').trim()
      const existingIndex = name
        ? model.groups.findIndex((item) => item.name === name)
        : null
      let targetIndex = existingIndex !== null && existingIndex >= 0 ? existingIndex : null
      applyMutation(fileName, (doc) => {
        if (name && targetIndex === null) targetIndex = addGroup(doc, name)
        moveAttribute(doc, groupIndex, attributeIndex, name ? targetIndex : null)
      })
      const updated = findEntry(fileName)
      const targetGroup =
        targetIndex === null ? null : updated?.model?.groups?.[targetIndex]
      if (updated?.model) {
        set({
          selection: toSelection(
            'attribute',
            updated.qualifiedName,
            targetGroup?.name ?? null,
            attribute.name,
          ),
        })
      }
    },

    linkAttributes: (sourceRef, targetRef) => {
      if (!sourceRef || !targetRef || sourceRef === targetRef) return
      const index = buildIndex(get().entries)
      const source = resolveRef(sourceRef, index)
      const target = resolveRef(targetRef, index)
      if (source?.kind !== 'attribute' || target?.kind !== 'attribute') return
      const entry = findEntryByObjectName(get().entries, target.objectName)
      if (!entry?.model) return
      const model = entry.model
      let groupIndex = null
      if (target.groupName) {
        groupIndex = model.groups.findIndex((group) => group.name === target.groupName)
        if (groupIndex < 0) return
      }
      const list = groupIndex === null ? model.attributes : model.groups[groupIndex].attributes
      const attributeIndex = (list ?? []).findIndex(
        (attribute) => attribute.name === target.attributeName,
      )
      if (attributeIndex < 0) return
      const attribute = list[attributeIndex]
      const from = attribute.origin?.from ?? []
      if (from.includes(source.ref)) return
      applyMutation(entry.fileName, (doc) =>
        setAttributeField(doc, groupIndex, attributeIndex, 'origin', {
          from: [...from, source.ref],
          formula: attribute.origin?.formula ?? '',
        }),
      )
    },

    applySource: (fileName, text) => {
      const entry = findEntry(fileName)
      if (!entry) return { ok: false, errors: [`Unknown file: ${fileName}`] }
      const doc = YAML.parseDocument(text ?? '')
      if (doc.errors.length > 0) {
        return { ok: false, errors: doc.errors.map((error) => error.message) }
      }
      normalizeComments(doc)
      const { raw, model, errors } = deriveModel(doc)
      set((state) => ({
        entries: state.entries.map((item) =>
          item.fileName === fileName
            ? { ...item, doc, raw, model, errors, dirty: true }
            : item,
        ),
        status: 'saving',
        message: null,
      }))
      scheduleSave(fileName)
      return { ok: true, errors, content: serializeObject(doc) }
    },

    resolveConflictReload: async () => {
      const conflict = get().conflict
      if (!conflict) return
      try {
        const file = await api.read(conflict.fileName)
        const entry = toEntry(file)
        set((state) => ({
          entries: state.entries.map((item) =>
            item.fileName === conflict.fileName ? entry : item,
          ),
          conflict: null,
          status: 'saved',
          message: null,
        }))
      } catch (error) {
        set({ status: 'error', message: error.message })
      }
    },

    resolveConflictOverwrite: async () => {
      const conflict = get().conflict
      if (!conflict) return
      set((state) => ({
        entries: state.entries.map((item) =>
          item.fileName === conflict.fileName
            ? { ...item, hash: conflict.currentHash, dirty: true }
            : item,
        ),
        conflict: null,
        status: 'saving',
      }))
      await flush(conflict.fileName)
    },

    dismissConflict: () => set({ conflict: null, status: 'idle', message: null }),

    getReferences: () => validateReferences(get().entries),

    getIndex: () => buildIndex(get().entries),
  }
})
