// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MarkdownOutline } from '@/components/panels/MarkdownOutline'
import { useProjectStore } from '@/lib/store/useProjectStore'

const TEXT = '# Title\n\n## Section A\n\n### Sub\n'

afterEach(cleanup)

describe('MarkdownOutline', () => {
  it('renders heading levels with # markers', () => {
    render(<MarkdownOutline fileName="guide.md" text={TEXT} />)
    expect(screen.getByText('#')).toBeTruthy()
    expect(screen.getByText('##')).toBeTruthy()
    expect(screen.getByText('###')).toBeTruthy()
    expect(screen.getByText('Title')).toBeTruthy()
    expect(screen.getByText('Section A')).toBeTruthy()
  })

  it('scrolls to a heading on click', () => {
    useProjectStore.setState({ anchor: null, activeHeading: null })
    render(<MarkdownOutline fileName="guide.md" text={TEXT} />)
    fireEvent.click(screen.getByText('Section A'))
    const state = useProjectStore.getState()
    expect(state.activeHeading).toBe('section-a')
    expect(state.anchor).toEqual({ path: 'guide.md', id: 'section-a' })
  })
})
