import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createObjectsRepository, resolveObjectsDir } from '../../server/objects.js'

const dirs = []

async function repository() {
  const dir = await mkdtemp(path.join(tmpdir(), 'data-flow-'))
  dirs.push(dir)
  return createObjectsRepository(dir)
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('resolveObjectsDir', () => {
  const root = '/project'

  it('defaults to <root>/objects', () => {
    const previous = process.env.OBJECTS_DIR
    delete process.env.OBJECTS_DIR
    try {
      expect(resolveObjectsDir(root, '')).toBe('/project/objects')
      expect(resolveObjectsDir(root, undefined)).toBe('/project/objects')
    } finally {
      if (previous !== undefined) process.env.OBJECTS_DIR = previous
    }
  })

  it('resolves a relative path against the root', () => {
    expect(resolveObjectsDir(root, '../shared/objects')).toBe('/shared/objects')
    expect(resolveObjectsDir(root, 'model')).toBe('/project/model')
  })

  it('keeps an absolute path as-is', () => {
    expect(resolveObjectsDir(root, '/data/objects')).toBe('/data/objects')
  })

  it('falls back to process.env.OBJECTS_DIR', () => {
    const previous = process.env.OBJECTS_DIR
    process.env.OBJECTS_DIR = '/env/objects'
    try {
      expect(resolveObjectsDir(root)).toBe('/env/objects')
    } finally {
      if (previous === undefined) delete process.env.OBJECTS_DIR
      else process.env.OBJECTS_DIR = previous
    }
  })
})

describe('objects repository namespaces', () => {
  it('creates and lists files in sub-directories', async () => {
    const repo = await repository()
    await repo.create('sales/client.yaml', 'name: client\n')
    await repo.create('crm/client.yaml', 'name: client\n')
    await repo.create('root.yaml', 'name: root\n')

    const list = await repo.list()
    expect(list.map((file) => file.name)).toEqual([
      'crm/client.yaml',
      'root.yaml',
      'sales/client.yaml',
    ])
    expect((await repo.read('sales/client.yaml')).content).toContain('name: client')
  })

  it('rejects path traversal', async () => {
    const repo = await repository()
    await expect(repo.read('../secret.yaml')).rejects.toThrow()
    await expect(repo.create('a/../../b.yaml', 'name: b\n')).rejects.toThrow()
  })
})
