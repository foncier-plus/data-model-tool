import { describe, expect, it } from 'vitest'
import {
  createDirectory,
  moveEntry,
  readText,
  readTree,
  removeEntry,
  renameEntry,
  writeText,
} from '@/lib/fs/notebook'
import { createMemoryNotebook } from '@/test/memoryNotebook'

function flatten(node, paths = []) {
  for (const child of node.children ?? []) {
    if (child.kind === 'directory') flatten(child, paths)
    else paths.push(child.path)
  }
  return paths
}

function flattenNodes(node, nodes = []) {
  for (const child of node.children ?? []) {
    if (child.kind === 'directory') flattenNodes(child, nodes)
    else nodes.push(child)
  }
  return nodes
}

describe('notebook file system', () => {
  it('walks directories and classifies supported files', async () => {
    const notebook = createMemoryNotebook({
      'sales/client.yaml': 'name: client\n',
      'sales/notes.md': '# Notes',
      'manual.pdf': 'pdf',
      'image.png': 'binary',
      '.hidden.yaml': 'name: hidden\n',
    })
    const tree = await readTree(notebook)
    expect(flatten(tree).sort()).toEqual([
      'image.png',
      'manual.pdf',
      'sales/client.yaml',
      'sales/notes.md',
    ])
  })

  it('classifies images', async () => {
    const notebook = createMemoryNotebook({ 'plan.png': 'png', 'photo.jpeg': 'jpg' })
    const tree = await readTree(notebook)
    const types = flattenNodes(tree).map((node) => [node.name, node.type])
    expect(types.sort()).toEqual([
      ['photo.jpeg', 'image'],
      ['plan.png', 'image'],
    ])
  })

  it('writes and reads text files', async () => {
    const notebook = createMemoryNotebook({})
    await writeText(notebook, 'a/b.yaml', 'name: b\n')
    expect(await readText(notebook, 'a/b.yaml')).toBe('name: b\n')
  })

  it('creates directories', async () => {
    const notebook = createMemoryNotebook({})
    await createDirectory(notebook, 'team/docs')
    const tree = await readTree(notebook)
    expect(tree.children[0].name).toBe('team')
  })

  it('renames and moves entries', async () => {
    const notebook = createMemoryNotebook({
      'a.yaml': 'name: a\n',
      'dir/keep.yaml': 'name: keep\n',
    })
    await renameEntry(notebook, 'a.yaml', 'b.yaml')
    expect(await readText(notebook, 'b.yaml')).toBe('name: a\n')

    await moveEntry(notebook, 'b.yaml', 'dir')
    expect(await readText(notebook, 'dir/b.yaml')).toBe('name: a\n')
  })

  it('removes entries', async () => {
    const notebook = createMemoryNotebook({ 'a.yaml': 'name: a\n' })
    await removeEntry(notebook, 'a.yaml')
    const tree = await readTree(notebook)
    expect(tree.children).toHaveLength(0)
  })
})
