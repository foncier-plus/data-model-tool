import { beforeEach, describe, expect, it } from 'vitest'
import { readText } from '@/lib/fs/notebook'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { createMemoryNotebook } from '@/test/memoryNotebook'

const NOTEBOOK = {
  'sales/model.yaml': `namespace: sales
name: client
attributes:
  - name: id
    type: string
  - name: label
    type: string
---
namespace: sales
name: client_import
attributes:
  - name: id
    origin:
      from: [client.id]
      formula: client.id
`,
  'docs/guide.md': '# Guide\n\n## Identité\n',
}

function reset() {
  useProjectStore.setState({
    handle: null,
    pendingHandle: null,
    notebookName: null,
    tree: null,
    files: [],
    entries: [],
    activeFile: null,
    activeView: 'data-model',
    anchor: null,
    selection: null,
    status: 'idle',
    message: null,
    conflict: null,
  })
}

describe('project store with a notebook', () => {
  let notebook

  beforeEach(() => {
    reset()
    notebook = createMemoryNotebook(NOTEBOOK)
  })

  it('loads entries from multi-document YAML files', async () => {
    await useProjectStore.getState().openNotebook(notebook)
    const state = useProjectStore.getState()
    expect(state.entries.map((entry) => entry.qualifiedName).sort()).toEqual([
      'sales.client',
      'sales.client_import',
    ])
    expect(state.notebookName).toBe('notebook')
  })

  it('edits an object and persists the whole file', async () => {
    await useProjectStore.getState().openNotebook(notebook)
    useProjectStore.getState().setObjectField('sales.client', 'description', 'Client final')
    await useProjectStore.getState().flush('sales/model.yaml')

    const content = await readText(notebook, 'sales/model.yaml')
    expect(content).toContain('description: Client final')
    expect(content).toContain('name: client_import')
  })

  it('replaces a file from source text', async () => {
    await useProjectStore.getState().openNotebook(notebook)
    const result = useProjectStore
      .getState()
      .applySource('sales/model.yaml', 'name: solo\nattributes: []\n')
    expect(result.ok).toBe(true)
    const entries = useProjectStore.getState().entries
    expect(entries.map((entry) => entry.qualifiedName)).toEqual(['solo'])
  })

  it('deletes an object by removing its document', async () => {
    await useProjectStore.getState().openNotebook(notebook)
    await useProjectStore.getState().deleteEntry('sales.client')
    const entries = useProjectStore.getState().entries
    expect(entries.map((entry) => entry.qualifiedName)).toEqual(['sales.client_import'])
  })

  it('creates and navigates to a wiki documentation link', async () => {
    const wiki = createMemoryNotebook({
      'model.yaml':
        'namespace: sales\nname: client\nabout: "[[docs/guide.md#Identité]]"\nattributes: []\n',
    })
    await useProjectStore.getState().openNotebook(wiki)

    await useProjectStore.getState().openWikiLink('model.yaml', 'docs/guide.md', 'Identité')
    let state = useProjectStore.getState()
    expect(state.activeFile).toBe('docs/guide.md')
    expect(state.activeView).toBe('documentation')
    expect(state.anchor).toEqual({ path: 'docs/guide.md', id: 'identite' })
    expect(await readText(wiki, 'docs/guide.md')).toBe('## Identité\n')

    await useProjectStore.getState().openWikiLink('model.yaml', 'docs/guide.md', 'Identité')
    expect(await readText(wiki, 'docs/guide.md')).toBe('## Identité\n')

    await useProjectStore.getState().openWikiLink('model.yaml', 'docs/guide.md', 'Autre')
    expect(await readText(wiki, 'docs/guide.md')).toBe('## Identité\n\n## Autre\n')
  })

  it('keeps the selection in sync when the namespace changes', async () => {
    await useProjectStore.getState().openNotebook(notebook)
    const id = 'sales.client'
    useProjectStore.getState().select({
      kind: 'object',
      objectName: id,
      groupName: null,
      attributeName: null,
      ref: id,
    })

    useProjectStore.getState().setObjectField(id, 'namespace', 'sales.crm')

    const entry = useProjectStore
      .getState()
      .entries.find((item) => item.raw.name === 'client')
    expect(entry.qualifiedName).toBe('sales.crm.client')
    expect(entry.namespace).toBe('sales.crm')
    expect(useProjectStore.getState().selection.objectName).toBe('sales.crm.client')
  })

  it('moves an object back to the root when the namespace is cleared', async () => {
    await useProjectStore.getState().openNotebook(notebook)
    const id = 'sales.client'
    useProjectStore.getState().select({
      kind: 'object',
      objectName: id,
      groupName: null,
      attributeName: null,
      ref: id,
    })

    useProjectStore.getState().setObjectField(id, 'namespace', '')

    const entry = useProjectStore
      .getState()
      .entries.find((item) => item.raw.name === 'client')
    expect(entry.qualifiedName).toBe('client')
    expect(entry.namespace).toBeNull()
    expect(useProjectStore.getState().selection.objectName).toBe('client')
  })
})
