// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OriginForm } from '@/components/editor/OriginForm'

const ENTRIES = [
  {
    model: {
      name: 'tiers',
      attributes: [
        { name: 'id' },
        { name: 'name' },
      ],
    },
  },
  {
    model: {
      name: 'client',
      attributes: [{ name: 'id_client' }],
      groups: [
        {
          name: 'identity',
          attributes: [{ name: 'first_name' }, { name: 'full_name' }],
        },
      ],
    },
  },
]

afterEach(cleanup)

describe('OriginForm', () => {
  it('shows committed sources and an empty draft field', () => {
    render(
      <OriginForm
        origin={{ from: ['tiers.id'] }}
        onChange={() => {}}
        resetKey="a"
        entries={ENTRIES}
      />,
    )

    expect(screen.getByText('tiers.id')).toBeTruthy()
    expect(screen.getByPlaceholderText('object.attribute').value).toBe('')
  })

  it('suggests existing references', () => {
    const { container } = render(
      <OriginForm origin={{ from: [] }} onChange={() => {}} resetKey="a" entries={ENTRIES} />,
    )

    const refs = [...container.querySelectorAll('#origin-source-options option')].map(
      (option) => option.value,
    )
    expect(refs).toContain('tiers.id')
    expect(refs).toContain('client.full_name')
    expect(refs).toContain('client.identity')
  })

  it('adds the draft to the sources when validated with Enter', () => {
    const onChange = vi.fn()
    render(
      <OriginForm
        origin={{ from: ['tiers.id'] }}
        onChange={onChange}
        resetKey="a"
        entries={ENTRIES}
      />,
    )

    const draft = screen.getByPlaceholderText('object.attribute')
    fireEvent.change(draft, { target: { value: 'client.id_client' } })
    fireEvent.keyDown(draft, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith({
      from: ['tiers.id', 'client.id_client'],
      formula: '',
    })
  })
})
