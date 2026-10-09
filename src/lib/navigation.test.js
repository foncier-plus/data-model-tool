import { describe, expect, it } from 'vitest'
import { resolveEditorFile, resolveFocus, resolveSidebarKey } from '@/lib/navigation'

const ENTRIES = [
  { qualifiedName: 'sales.client', fileName: 'sales/model.yaml', model: { name: 'client' } },
]

const ELEMENT = {
  kind: 'attribute',
  objectName: 'sales.client',
  groupName: null,
  attributeName: 'id',
  ref: 'sales.client.id',
}

describe('resolveEditorFile', () => {
  it('prefers the documentation target', () => {
    expect(
      resolveEditorFile({
        activeFile: 'main.yaml',
        entries: ENTRIES,
        selection: ELEMENT,
        docTarget: { fileName: 'docs/guide.md' },
      }),
    ).toBe('docs/guide.md')
  })

  it('uses the selected element file', () => {
    expect(
      resolveEditorFile({ activeFile: 'main.yaml', entries: ENTRIES, selection: ELEMENT }),
    ).toBe('sales/model.yaml')
  })

  it('falls back to the main file', () => {
    expect(
      resolveEditorFile({ activeFile: 'main.yaml', entries: ENTRIES, selection: null }),
    ).toBe('main.yaml')
  })
})

describe('resolveFocus', () => {
  it('prioritizes the document target', () => {
    const focus = resolveFocus(ELEMENT, { fileName: 'docs/guide.md' })
    expect(focus).toEqual({ type: 'document', target: { fileName: 'docs/guide.md' } })
  })

  it('returns the element focus', () => {
    expect(resolveFocus(ELEMENT, null)).toEqual({ type: 'element', selection: ELEMENT })
  })

  it('returns null when the main file is focused', () => {
    expect(resolveFocus(null, null)).toBeNull()
  })
})

describe('resolveSidebarKey', () => {
  it('shows the outline for a document focus or a markdown file', () => {
    expect(resolveSidebarKey('yaml', { type: 'document', target: {} })).toBe('outline')
    expect(resolveSidebarKey('markdown', null)).toBe('outline')
  })

  it('shows the project form when a project has no element focus', () => {
    expect(resolveSidebarKey('project', null)).toBe('project')
  })

  it('shows the inspector otherwise', () => {
    expect(resolveSidebarKey('project', { type: 'element', selection: ELEMENT })).toBe('inspector')
    expect(resolveSidebarKey('yaml', { type: 'element', selection: ELEMENT })).toBe('inspector')
  })
})
