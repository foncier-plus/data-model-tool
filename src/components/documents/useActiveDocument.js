import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { documentSessionBridge } from '@/lib/documentSessionBridge'

// Module-level session store keyed by file name, so several components (the
// main view and the source editor) can share the same text for a file.
const sessions = new Map()

function getSession(fileName) {
  let session = sessions.get(fileName)
  if (!session) {
    session = {
      text: '',
      saved: '',
      loaded: false,
      loading: false,
      revision: -1,
      timer: null,
      listeners: new Set(),
    }
    sessions.set(fileName, session)
  }
  return session
}

function emit(session) {
  for (const listener of session.listeners) listener()
}

async function persist(fileName) {
  const session = sessions.get(fileName)
  if (!session || session.text === session.saved) return
  if (session.timer) {
    clearTimeout(session.timer)
    session.timer = null
  }
  const value = session.text
  const expected = session.saved
  const ok = await useProjectStore.getState().saveDocument(fileName, value, expected)
  if (ok) session.saved = value
}

async function load(fileName) {
  const session = getSession(fileName)
  if (session.loaded || session.loading) return
  session.loading = true
  try {
    const content = await useProjectStore.getState().readDocument(fileName)
    session.text = content ?? ''
    session.saved = session.text
  } catch {
    // ignore read errors
  }
  session.loaded = true
  session.loading = false
  emit(session)
}

function update(fileName, value) {
  const session = getSession(fileName)
  session.text = value
  if (session.timer) clearTimeout(session.timer)
  session.timer = setTimeout(() => persist(fileName), 600)
  emit(session)
}

export function flushDocument(fileName) {
  return persist(fileName)
}

export function resetDocumentSessions() {
  for (const session of sessions.values()) {
    if (session.timer) clearTimeout(session.timer)
  }
  sessions.clear()
}

// Let the project store resolve conflicts for project/markdown files.
documentSessionBridge.reload = (fileName, content) => {
  const session = getSession(fileName)
  session.text = content ?? ''
  session.saved = session.text
  session.loaded = true
  emit(session)
}

function subscribe(fileName, listener) {
  const session = getSession(fileName)
  session.listeners.add(listener)
  return () => session.listeners.delete(listener)
}

export function useActiveDocument(fileName, enabled = true) {
  const active = Boolean(enabled && fileName)
  const subscribeFn = useCallback(
    (listener) => (active ? subscribe(fileName, listener) : () => {}),
    [active, fileName],
  )
  const getSnapshot = useCallback(
    () => (active ? getSession(fileName).text : ''),
    [active, fileName],
  )
  const text = useSyncExternalStore(subscribeFn, getSnapshot)
  const docRevision = useProjectStore((state) => state.docRevision)

  useEffect(() => {
    if (!active) return
    const session = getSession(fileName)
    if (session.revision !== docRevision) {
      session.revision = docRevision
      if (session.text === session.saved) session.loaded = false
    }
    load(fileName)
  }, [active, fileName, docRevision])

  return {
    text,
    onChange: (value) => {
      if (active) update(fileName, value)
    },
    flush: () => {
      if (active) persist(fileName)
    },
  }
}
