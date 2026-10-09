// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TopBreadcrumb } from '@/components/documents/TopBreadcrumb'
import { useProjectStore } from '@/lib/store/useProjectStore'

const ENTRIES = [
  {
    qualifiedName: 'sales.client',
    fileName: 'dir/model.object.yaml',
    namespace: 'sales',
    model: { name: 'client', attributes: [] },
  },
]

afterEach(() => {
  cleanup()
  useProjectStore.setState({ entries: [], selection: null })
})

describe('TopBreadcrumb', () => {
  it('shows the file name without directory or type extension', () => {
    useProjectStore.setState({ entries: ENTRIES })
    render(<TopBreadcrumb fileName="dir/model.object.yaml" focus={null} />)
    expect(screen.getByText('model')).toBeTruthy()
    expect(screen.queryByText('dir')).toBeNull()
    expect(screen.queryByText('model.object')).toBeNull()
  })

  it('shows the object without namespace and selects the object on click', () => {
    useProjectStore.setState({ entries: ENTRIES })
    const selection = {
      kind: 'attribute',
      objectName: 'sales.client',
      groupName: 'identity',
      attributeName: 'id',
      ref: 'sales.client.id',
    }
    render(
      <TopBreadcrumb
        fileName="dir/model.object.yaml"
        focus={{ type: 'element', selection }}
      />,
    )

    expect(screen.getByText('client')).toBeTruthy()
    expect(screen.queryByText('sales.client')).toBeNull()
    expect(screen.getByText('identity')).toBeTruthy()
    expect(screen.getByText('id')).toBeTruthy()

    fireEvent.click(screen.getByText('client'))
    expect(useProjectStore.getState().selection.kind).toBe('object')
    expect(useProjectStore.getState().selection.objectName).toBe('sales.client')
  })
})
