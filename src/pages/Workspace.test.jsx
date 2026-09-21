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

async function waitForGraph(container) {
  await waitFor(() => {
    expect(useProjectStore.getState().entries).toHaveLength(2)
  })
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

    const panel = container.querySelectorAll('aside')[0]
    await waitFor(() => {
      expect(within(panel).getAllByText('tiers.id').length).toBeGreaterThan(0)
    })
  })
})
