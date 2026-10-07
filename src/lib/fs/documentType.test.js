import { describe, expect, it } from 'vitest'
import {
  classifyFile,
  extensionOf,
  isSupportedFile,
  splitFileName,
} from '@/lib/fs/documentType'

describe('splitFileName', () => {
  it('hides the object/project type extension from the base', () => {
    expect(splitFileName('foo.object.yaml')).toEqual({
      base: 'foo',
      extension: '.object.yaml',
    })
    expect(splitFileName('foo.project.yaml')).toEqual({
      base: 'foo',
      extension: '.project.yaml',
    })
    expect(splitFileName('bar.project.yml')).toEqual({
      base: 'bar',
      extension: '.project.yml',
    })
  })

  it('keeps the simple extension for other files', () => {
    expect(splitFileName('foo.yaml')).toEqual({ base: 'foo', extension: '.yaml' })
    expect(splitFileName('guide.md')).toEqual({ base: 'guide', extension: '.md' })
    expect(splitFileName('noext')).toEqual({ base: 'noext', extension: '' })
  })
})

describe('classifyFile', () => {
  it('classifies project files', () => {
    expect(classifyFile('foo.project.yaml')).toBe('project')
    expect(classifyFile('foo.project.yml')).toBe('project')
    expect(classifyFile('Foo.Project.YAML')).toBe('project')
  })

  it('classifies other supported files', () => {
    expect(classifyFile('foo.yaml')).toBe('yaml')
    expect(classifyFile('foo.object.yaml')).toBe('yaml')
    expect(classifyFile('foo.object.yml')).toBe('yaml')
    expect(classifyFile('foo.yml')).toBe('yaml')
    expect(classifyFile('foo.md')).toBe('markdown')
    expect(classifyFile('foo.pdf')).toBe('pdf')
    expect(classifyFile('foo.png')).toBe('image')
    expect(classifyFile('foo.project.md')).toBe('markdown')
    expect(classifyFile('foo.txt')).toBe('other')
  })

  it('computes extensions and support', () => {
    expect(extensionOf('a/b/c.yaml')).toBe('.yaml')
    expect(extensionOf('noext')).toBe('')
    expect(isSupportedFile('foo.project.yaml')).toBe(true)
    expect(isSupportedFile('foo.object.yaml')).toBe(true)
    expect(isSupportedFile('foo.txt')).toBe(false)
  })
})
