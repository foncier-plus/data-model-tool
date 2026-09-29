import { EditorView, Decoration, ViewPlugin } from '@codemirror/view'
import { StateEffect, StateField } from '@codemirror/state'
import { foldable } from '@codemirror/language'

const setFoldHover = StateEffect.define()

const hoverLine = Decoration.line({ class: 'cm-foldHoverLine' })

const hoverField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    let next = deco.map(tr.changes)
    for (const effect of tr.effects) {
      if (!effect.is(setFoldHover)) continue
      if (!effect.value) return Decoration.none
      const { from, to } = effect.value
      const lines = []
      let pos = from
      while (pos <= to) {
        const line = tr.state.doc.lineAt(pos)
        lines.push(hoverLine.range(line.from))
        pos = line.to + 1
      }
      next = Decoration.set(lines, true)
    }
    return next
  },
  provide: (field) => EditorView.decorations.from(field),
})

function hoverPlugin() {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view
        this.key = null
        this.onMove = (event) => this.handle(event)
        this.onLeave = () => this.clear()
        view.dom.addEventListener('mousemove', this.onMove)
        view.dom.addEventListener('mouseleave', this.onLeave)
      }

      handle(event) {
        const element = event.target?.closest?.('.cm-foldGutter .cm-gutterElement')
        if (!element) {
          this.clear()
          return
        }
        const rect = element.getBoundingClientRect()
        const contentRect = this.view.contentDOM.getBoundingClientRect()
        const pos = this.view.posAtCoords({ x: contentRect.left + 2, y: rect.top + rect.height / 2 })
        if (pos === null || pos === undefined) {
          this.clear()
          return
        }
        const line = this.view.state.doc.lineAt(pos)
        const range = foldable(this.view.state, line.from, line.to)
        if (!range) {
          this.clear()
          return
        }
        const key = `${range.from}:${range.to}`
        if (key === this.key) return
        this.key = key
        this.view.dispatch({ effects: setFoldHover.of(range) })
      }

      clear() {
        if (this.key === null) return
        this.key = null
        this.view.dispatch({ effects: setFoldHover.of(null) })
      }

      update(update) {
        if (update.docChanged) this.clear()
      }

      destroy() {
        this.view.dom.removeEventListener('mousemove', this.onMove)
        this.view.dom.removeEventListener('mouseleave', this.onLeave)
      }
    },
  )
}

export const foldHoverHighlight = [hoverField, hoverPlugin()]
