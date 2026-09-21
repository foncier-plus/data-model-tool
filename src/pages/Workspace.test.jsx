// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from '@/App'
import { useProjectStore } from '@/lib/store/useProjectStore'

const OBJECTS = [
  {
    name: 'tiers.yaml',
    content: `name: tiers
attributes:
  - name: id
    type: string
  - name: name
    type: string
`,
    hash: 'a',
    mtime: 1,
  },
  {
    name: 'client.yaml',
    content: `name: client
attributes:
  - name: id_client
    type: string
    origin:
      from: [tiers.id]
      formula: tiers.id
  - name: display_name
    type: string
    origin:
      from: [tiers.name]
      formula: tiers.name
`,
    hash: 'b',
    mtime: 2,
  },
]

beforeEach(() => {
  useProjectStore.setState({
    entries: [],
    status: 'idle',
    message: null,
    conflict: null,
    selection: null,
    panelTab: 'edit',
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ objects: OBJECTS }),
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderApp() {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
}

async function selectAll() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Tout' })).toBeTruthy()
  })
  fireEvent.click(screen.getByRole('button', { name: 'Tout' }))
}

async function waitForGraph(container) {
  await waitFor(() => {
    expect(useProjectStore.getState().entries).toHaveLength(2)
  })
  await selectAll()
  await waitFor(() => {
    expect(container.querySelectorAll('.react-flow__node').length).toBe(2)
  })
  for (const button of container.querySelectorAll('button[aria-label="root attributes"]')) {
    fireEvent.click(button)
  }
  await waitFor(() => {
    expect(
      container.querySelectorAll('button[aria-label="root attributes"][aria-expanded="true"]')
        .length,
    ).toBeGreaterThan(0)
  })
}

describe('workspace', () => {
  it('renders one card per object with its attributes inside', async () => {
    const { container } = renderApp()
    await waitForGraph(container)

    const graphText = [...container.querySelectorAll('.react-flow__node')]
      .map((node) => node.textContent)
      .join(' ')
    expect(graphText).toContain('tiers')
    expect(graphText).toContain('client')
    expect(graphText).toContain('id_client')
    expect(graphText).toContain('display_name')
    expect(await screen.findByText('Saved to disk')).toBeTruthy()
  })

  it('renders a dashed group per namespace', async () => {
    const namespaced = [
      {
        name: 'sales/client.yaml',
        content: `name: client
attributes:
  - name: id
    type: string
`,
        hash: 'a',
        mtime: 1,
      },
      {
        name: 'crm/client.yaml',
        content: `name: client
attributes:
  - name: id
    type: string
`,
        hash: 'b',
        mtime: 2,
      },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ objects: namespaced }),
      })),
    )

    const { container } = renderApp()
    await waitFor(() => {
      expect(useProjectStore.getState().entries).toHaveLength(2)
    })
    await selectAll()
    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__node').length).toBe(4)
    })
    const graphText = [...container.querySelectorAll('.react-flow__node')]
      .map((node) => node.textContent)
      .join(' ')
    expect(graphText).toContain('sales')
    expect(graphText).toContain('crm')
  })

  it('collapses a namespace group and reroutes its links through the group', async () => {
    const namespaced = [
      {
        name: 'sales/client_sales.yaml',
        content: `name: client_sales
attributes:
  - name: id
    type: string
    origin:
      from: [crm.client_crm.id]
      formula: crm.client_crm.id
`,
        hash: 'a',
        mtime: 1,
      },
      {
        name: 'crm/client_crm.yaml',
        content: `name: client_crm
attributes:
  - name: id
    type: string
`,
        hash: 'b',
        mtime: 2,
      },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ objects: namespaced }),
      })),
    )

    const { container } = renderApp()
    await waitFor(() => {
      expect(useProjectStore.getState().entries).toHaveLength(2)
    })
    await selectAll()
    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__node').length).toBe(4)
    })
    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__edge').length).toBe(1)
    })

    const crmToggle = container.querySelector('button[aria-label="Replier crm"]')
    fireEvent.click(crmToggle)

    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__node').length).toBe(3)
    })
    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__edge').length).toBe(1)
    })
  })

  it('filters the graph from the explorer selection', async () => {
    const namespaced = [
      {
        name: 'sales/client_sales.yaml',
        content: `name: client_sales
attributes:
  - name: id
    type: string
`,
        hash: 'a',
        mtime: 1,
      },
      {
        name: 'crm/client_crm.yaml',
        content: `name: client_crm
attributes:
  - name: id
    type: string
`,
        hash: 'b',
        mtime: 2,
      },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ objects: namespaced }),
      })),
    )

    const { container } = renderApp()
    await waitFor(() => {
      expect(useProjectStore.getState().entries).toHaveLength(2)
    })
    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__node').length).toBe(0)
    })

    const expand = container.querySelector('button[aria-label="Déplier sales"]')
    fireEvent.click(expand)

    const checkbox = container.querySelector('input[aria-label="Sélectionner sales.client_sales"]')
    fireEvent.click(checkbox)

    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__node').length).toBe(2)
    })
    const graphText = [...container.querySelectorAll('.react-flow__node')]
      .map((node) => node.textContent)
      .join(' ')
    expect(graphText).toContain('client_sales')
    expect(graphText).not.toContain('client_crm')
  })

  it('shows object links by default and attribute links once an attribute is selected', async () => {
    const { container } = renderApp()
    await waitForGraph(container)

    const handlesBefore = container.querySelectorAll('.react-flow__handle').length
    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__edge').length).toBe(1)
    })

    const attributeButton = [...container.querySelectorAll('.react-flow__node button')].find(
      (button) => button.textContent.includes('id_client'),
    )
    fireEvent.click(attributeButton)

    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__edge').length).toBe(2)
    })
    expect(container.querySelectorAll('.react-flow__handle').length).toBeGreaterThan(
      handlesBefore,
    )
  })

  it('selects an attribute by clicking it inside the object card', async () => {
    const { container } = renderApp()
    await waitForGraph(container)

    const attributeButton = [...container.querySelectorAll('.react-flow__node button')].find(
      (button) => button.textContent.includes('id_client'),
    )
    expect(attributeButton).toBeTruthy()
    fireEvent.click(attributeButton)

    await waitFor(() => {
      expect(useProjectStore.getState().selection?.ref).toBe('client.id_client')
    })
    expect(await screen.findByDisplayValue('id_client')).toBeTruthy()
  })

  it('highlights the attribute links of the selected field', async () => {
    const { container } = renderApp()
    await waitForGraph(container)

    const attributeButton = [...container.querySelectorAll('.react-flow__node button')].find(
      (button) => button.textContent.includes('id_client'),
    )
    fireEvent.click(attributeButton)

    await waitFor(() => {
      const paths = [...container.querySelectorAll('.react-flow__edge path')]
      expect(
        paths.some((path) => path.getAttribute('style')?.includes('stroke-width: 3')),
      ).toBe(true)
    })
  })

  it('does not move objects when an attribute is selected', async () => {
    const { container } = renderApp()
    await waitForGraph(container)

    const transformOf = (id) =>
      container.querySelector(`.react-flow__node[data-id="${id}"]`)?.style.transform
    const before = ['tiers', 'client'].map(transformOf)

    const attributeButton = [...container.querySelectorAll('.react-flow__node button')].find(
      (button) => button.textContent.includes('id_client'),
    )
    fireEvent.click(attributeButton)

    await waitFor(() => {
      expect(useProjectStore.getState().selection?.kind).toBe('attribute')
    })
    expect(['tiers', 'client'].map(transformOf)).toEqual(before)
  })

  it('deselects when clicking outside an object', async () => {
    const { container } = renderApp()
    await waitForGraph(container)

    const attributeButton = [...container.querySelectorAll('.react-flow__node button')].find(
      (button) => button.textContent.includes('id_client'),
    )
    fireEvent.click(attributeButton)
    await waitFor(() => {
      expect(useProjectStore.getState().selection).toBeTruthy()
    })

    fireEvent.click(container.querySelector('.react-flow__pane'))
    await waitFor(() => {
      expect(useProjectStore.getState().selection).toBeNull()
    })
  })

  it('auto-expands the object linked to the selected attribute', async () => {
    const data = [
      {
        name: 'tiers.yaml',
        content: `name: tiers
attributes:
  - name: name
    type: string
`,
        hash: 'a',
        mtime: 1,
      },
      {
        name: 'client.yaml',
        content: `name: client
attributes:
  - name: id
    type: string
groups:
  - name: identity
    attributes:
      - name: full_name
        type: string
        origin:
          from: [tiers.name]
          formula: tiers.name
`,
        hash: 'b',
        mtime: 2,
      },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ objects: data }),
      })),
    )

    const { container } = renderApp()
    await waitForGraph(container)

    const graphText = () =>
      [...container.querySelectorAll('.react-flow__node')].map((node) => node.textContent).join(' ')
    expect(graphText()).not.toContain('full_name')

    const nameButton = [...container.querySelectorAll('.react-flow__node button')].find(
      (button) => button.textContent.includes('name'),
    )
    fireEvent.click(nameButton)

    await waitFor(() => {
      expect(useProjectStore.getState().selection?.ref).toBe('tiers.name')
    })
    await waitFor(() => {
      expect(graphText()).toContain('full_name')
    })
  })

  it('clears an attribute example and removes the property', async () => {
    const data = [
      {
        name: 'client.yaml',
        content: `name: client
attributes:
  - name: id
    type: string
    example: ABC
`,
        hash: 'a',
        mtime: 1,
      },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ objects: data }),
      })),
    )

    const { container } = renderApp()
    await waitFor(() => {
      expect(useProjectStore.getState().entries).toHaveLength(1)
    })
    await selectAll()
    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__node').length).toBe(1)
    })
    for (const button of container.querySelectorAll('button[aria-label="root attributes"]')) {
      fireEvent.click(button)
    }

    const attributeButton = [...container.querySelectorAll('.react-flow__node button')].find(
      (button) => button.textContent.includes('id'),
    )
    fireEvent.click(attributeButton)
    await waitFor(() => {
      expect(useProjectStore.getState().selection?.kind).toBe('attribute')
    })

    const input = await screen.findByPlaceholderText('example value')
    expect(input.value).toBe('ABC')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(useProjectStore.getState().entries[0].model.attributes[0].example).toBe('')
    })
    expect(input.value).toBe('')
  })

  it('reveals dependencies in other objects and collapses stale groups', async () => {
    const data = [
      {
        name: 'a.yaml',
        content: `name: a
attributes:
  - name: a1
    type: string
    origin:
      from: [b.b1]
      formula: b.b1
  - name: a2
    type: string
    origin:
      from: [c.c1]
      formula: c.c1
`,
        hash: 'a',
        mtime: 1,
      },
      {
        name: 'b.yaml',
        content: `name: b
groups:
  - name: bg
    attributes:
      - name: b1
        type: string
`,
        hash: 'b',
        mtime: 2,
      },
      {
        name: 'c.yaml',
        content: `name: c
groups:
  - name: cg
    attributes:
      - name: c1
        type: string
`,
        hash: 'c',
        mtime: 3,
      },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ objects: data }),
      })),
    )

    const { container } = renderApp()
    await waitFor(() => {
      expect(useProjectStore.getState().entries).toHaveLength(3)
    })
    await selectAll()
    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__node').length).toBe(3)
    })
    for (const button of container.querySelectorAll('button[aria-label="root attributes"]')) {
      fireEvent.click(button)
    }

    const expanded = (label) =>
      container.querySelector(`button[aria-label="${label}"]`)?.getAttribute('aria-expanded')
    await waitFor(() => expect(expanded('bg')).toBe('false'))
    expect(expanded('cg')).toBe('false')

    const a1Button = [...container.querySelectorAll('.react-flow__node button')].find(
      (button) => button.textContent.includes('a1') && button.textContent.includes('string'),
    )
    fireEvent.click(a1Button)
    await waitFor(() => expect(useProjectStore.getState().selection?.ref).toBe('a.a1'))
    await waitFor(() => expect(expanded('bg')).toBe('true'))
    expect(expanded('cg')).toBe('false')

    const a2Button = [...container.querySelectorAll('.react-flow__node button')].find(
      (button) => button.textContent.includes('a2') && button.textContent.includes('string'),
    )
    fireEvent.click(a2Button)
    await waitFor(() => expect(useProjectStore.getState().selection?.ref).toBe('a.a2'))
    await waitFor(() => expect(expanded('cg')).toBe('true'))
    await waitFor(() => expect(expanded('bg')).toBe('false'))
  })

  it('keeps a namespace group selected after a click', async () => {
    const namespaced = [
      {
        name: 'sales/client.yaml',
        content: `name: client
attributes:
  - name: id
    type: string
`,
        hash: 'a',
        mtime: 1,
      },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ objects: namespaced }),
      })),
    )

    const { container } = renderApp()
    await waitFor(() => expect(useProjectStore.getState().entries).toHaveLength(1))
    await selectAll()
    await waitFor(() => expect(container.querySelectorAll('.react-flow__node').length).toBe(2))

    const label = container.querySelector('.react-flow__node[data-id="ns:sales"] span.font-mono')
    fireEvent.click(label)
    await waitFor(() => {
      expect(container.querySelector('.react-flow__node.selected[data-id="ns:sales"]')).toBeTruthy()
    })
  })

  it('selects an edge when clicked', async () => {
    const { container } = renderApp()
    await waitForGraph(container)

    const path = container.querySelector('.react-flow__edge path')
    fireEvent.click(path)
    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__edge.selected').length).toBe(1)
    })
  })

  it('collapses the groups of unrelated objects when analyzing', async () => {
    const data = [
      {
        name: 'a.yaml',
        content: `name: a
attributes:
  - name: a1
    type: string
    origin:
      from: [b.b1]
      formula: b.b1
`,
        hash: 'a',
        mtime: 1,
      },
      {
        name: 'b.yaml',
        content: `name: b
groups:
  - name: bg
    attributes:
      - name: b1
        type: string
`,
        hash: 'b',
        mtime: 2,
      },
      {
        name: 'd.yaml',
        content: `name: d
groups:
  - name: dg
    attributes:
      - name: d1
        type: string
`,
        hash: 'c',
        mtime: 3,
      },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ objects: data }),
      })),
    )

    const { container } = renderApp()
    await waitFor(() => expect(useProjectStore.getState().entries).toHaveLength(3))
    await selectAll()
    await waitFor(() => expect(container.querySelectorAll('.react-flow__node').length).toBe(3))
    for (const button of container.querySelectorAll('button[aria-label="root attributes"]')) {
      fireEvent.click(button)
    }

    const expanded = (label) =>
      container.querySelector(`button[aria-label="${label}"]`)?.getAttribute('aria-expanded')

    fireEvent.click(container.querySelector('button[aria-label="dg"]'))
    await waitFor(() => expect(expanded('dg')).toBe('true'))

    const a1Button = [...container.querySelectorAll('.react-flow__node button')].find(
      (button) => button.textContent.includes('a1') && button.textContent.includes('string'),
    )
    fireEvent.click(a1Button)
    await waitFor(() => expect(useProjectStore.getState().selection?.ref).toBe('a.a1'))

    await waitFor(() => expect(expanded('bg')).toBe('true'))
    await waitFor(() => expect(expanded('dg')).toBe('false'))
  })

  it('shows the origin in the formula tab', async () => {
    const { container } = renderApp()
    await waitForGraph(container)

    const attributeButton = [...container.querySelectorAll('.react-flow__node button')].find(
      (button) => button.textContent.includes('id_client'),
    )
    fireEvent.click(attributeButton)
    await waitFor(() => {
      expect(useProjectStore.getState().selection?.ref).toBe('client.id_client')
    })

    const formulaTab = screen.getByRole('tab', { name: 'Formulas' })
    fireEvent.mouseDown(formulaTab)
    fireEvent.click(formulaTab)

    const panel = container.querySelectorAll('aside')[1]
    await waitFor(() => {
      expect(within(panel).getAllByText('tiers.id').length).toBeGreaterThan(0)
    })
  })
})
