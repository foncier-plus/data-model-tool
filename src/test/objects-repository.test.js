import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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

    const { objects, namespaces } = await repo.list()
    expect(objects.map((file) => file.name)).toEqual([
      'crm/client.yaml',
      'root.yaml',
      'sales/client.yaml',
    ])
    expect(namespaces).toEqual(['crm', 'sales'])
    expect((await repo.read('sales/client.yaml')).content).toContain('name: client')
  })

  it('rejects path traversal', async () => {
    const repo = await repository()
    await expect(repo.read('../secret.yaml')).rejects.toThrow()
    await expect(repo.create('a/../../b.yaml', 'name: b\n')).rejects.toThrow()
  })

  it('accepts project and namespace names containing spaces and special characters', async () => {
    const repo = await repository()
    await repo.create('Projet Foncier+/FONCIER_PLUS/bati.yaml', 'name: bati\n')
    await repo.create('Fichier DINNOV/parcelle disponible.yaml', 'name: parcelle\n')

    const { objects } = await repo.list()
    expect(objects.map((file) => file.name)).toEqual([
      'Fichier DINNOV/parcelle disponible.yaml',
      'Projet Foncier+/FONCIER_PLUS/bati.yaml',
    ])
    expect((await repo.read('Projet Foncier+/FONCIER_PLUS/bati.yaml')).content).toContain(
      'name: bati',
    )
  })

  it('creates an empty namespace that is listed', async () => {
    const repo = await repository()
    await repo.createNamespace('Projet Foncier+/Nouveau')
    const { namespaces } = await repo.list()
    expect(namespaces).toContain('Projet Foncier+/Nouveau')
  })

  it('ignores hidden files and directories', async () => {
    const repo = await repository()
    await repo.create('visible.yaml', 'name: visible\n')
    await mkdir(path.join(repo.root, '.hidden'), { recursive: true })
    await writeFile(path.join(repo.root, '.hidden', 'x.yaml'), 'name: x\n')
    await writeFile(path.join(repo.root, '.secret.yaml'), 'name: secret\n')

    const { objects, namespaces } = await repo.list()
    expect(objects.map((file) => file.name)).toEqual(['visible.yaml'])
    expect(namespaces).toEqual([])
  })
})
