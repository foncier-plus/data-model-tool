import { findEntryByObjectName } from './selection'

// Central navigation helpers, shared by the workspace, the editor and the
// top-bar breadcrumb.

export function findSelectionEntry(entries, selection) {
  return selection ? findEntryByObjectName(entries, selection.objectName) : null
}

// The file the source editor should display.
export function resolveEditorFile({ activeFile, entries, selection, docTarget }) {
  const entry = findSelectionEntry(entries, selection)
  return docTarget?.fileName ?? entry?.fileName ?? activeFile
}

// The current focus: an element (object/group/attribute) or a document
// (markdown target), or null when the main file is focused.
export function resolveFocus(selection, docTarget) {
  if (docTarget) return { type: 'document', target: docTarget }
  if (selection) return { type: 'element', selection }
  return null
}

// Which side panel to render for the current document + focus.
export function resolveSidebarKey(activeType, focus) {
  if (focus?.type === 'document') return 'outline'
  if (activeType === 'markdown') return 'outline'
  if (activeType === 'project' && !focus) return 'project'
  return 'inspector'
}
