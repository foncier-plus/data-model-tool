import { describe, expect, it } from 'vitest'
import YAML from 'yaml'
import { setProjectField, setProjectList } from '@/lib/model/projectMutations'

const SOURCE = `# Manifeste
title: Mon projet
description: >-
  Une description.
include:
  - NS1.*
exclude:
  - NS1.ObjectBeta
`

const load = (text) => YAML.parseDocument(text).toJS()

describe('project mutations', () => {
  it('updates a scalar field and keeps other fields', () => {
    const output = setProjectField(SOURCE, 'title', 'Nouveau titre')
    expect(output).toContain('# Manifeste')
    const data = load(output)
    expect(data.title).toBe('Nouveau titre')
    expect(data.include).toEqual(['NS1.*'])
  })

  it('replaces a list', () => {
    const output = setProjectList(SOURCE, 'include', ['NS1.*', 'NS2.ObjectDelta'])
    expect(load(output).include).toEqual(['NS1.*', 'NS2.ObjectDelta'])
  })

  it('removes an empty field', () => {
    const output = setProjectField(SOURCE, 'description', '')
    expect(load(output).description).toBeUndefined()
  })

  it('keeps the canonical field order', () => {
    const shuffled = `include:\n  - NS1.*\ntitle: T\ndescription: D\nexclude: []\n`
    const output = setProjectField(shuffled, 'title', 'T2')
    const keys = output
      .split('\n')
      .filter((line) => /^[a-z]+:/.test(line))
      .map((line) => line.slice(0, line.indexOf(':')))
    expect(keys).toEqual(['title', 'description', 'include', 'exclude'])
  })
})
