import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

function createTheme(colors) {
  const highlight = HighlightStyle.define([
    { tag: t.heading1, color: colors.blue, fontSize: '1.5em', fontWeight: '700' },
    { tag: t.heading2, color: colors.blue, fontSize: '1.3em', fontWeight: '700' },
    { tag: t.heading3, color: colors.blue, fontSize: '1.15em', fontWeight: '700' },
    { tag: [t.heading4, t.heading5, t.heading6], color: colors.blue, fontWeight: '700' },
    { tag: [t.strong], color: colors.orange, fontWeight: '700' },
    { tag: [t.emphasis], color: colors.purple, fontStyle: 'italic' },
    { tag: [t.strikethrough], color: colors.comment, textDecoration: 'line-through' },
    { tag: [t.link, t.url], color: colors.aqua, textDecoration: 'underline' },
    { tag: [t.monospace], color: colors.green },
    { tag: [t.comment, t.lineComment, t.blockComment], color: colors.comment, fontStyle: 'italic' },
    { tag: [t.keyword, t.operatorKeyword, t.controlKeyword, t.definitionKeyword], color: colors.purple },
    { tag: [t.string, t.character, t.attributeValue], color: colors.green },
    { tag: [t.number, t.integer, t.float, t.bool, t.null, t.atom], color: colors.orange },
    { tag: [t.propertyName, t.definition(t.propertyName), t.tagName, t.attributeName], color: colors.blue },
    { tag: [t.typeName, t.className], color: colors.yellow },
    { tag: [t.variableName, t.name], color: colors.fg },
    { tag: [t.punctuation, t.separator, t.bracket, t.paren, t.brace, t.squareBracket], color: colors.subtle },
    { tag: [t.contentSeparator, t.meta, t.processingInstruction], color: colors.comment },
    { tag: [t.operator], color: colors.aqua },
    { tag: t.invalid, color: colors.red },
  ])

  const theme = EditorView.theme(
    {
      '&': { color: colors.fg, backgroundColor: colors.bg, fontSize: '12px' },
      '.cm-content': {
        caretColor: colors.fg,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        padding: '8px 0',
      },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: colors.fg },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: colors.selection,
      },
      '.cm-gutters': {
        backgroundColor: colors.gutterBg,
        color: colors.gutterText,
        border: 'none',
        borderRight: `1px solid ${colors.gutterBorder}`,
        fontSize: '10px',
      },
      '.cm-lineNumbers .cm-gutterElement': { padding: '0 4px 0 6px', minWidth: '18px' },
      '.cm-foldGutter .cm-gutterElement': { padding: '0 2px 0 0' },
      '.cm-activeLineGutter': { backgroundColor: colors.line },
      '.cm-activeLine': { backgroundColor: colors.activeLineBg },
      '.cm-selectionMatch': { backgroundColor: colors.selection },
      '.cm-foldPlaceholder': { backgroundColor: colors.line, border: 'none', color: colors.comment },
      '.cm-tooltip': {
        backgroundColor: colors.bg,
        border: `1px solid ${colors.selection}`,
        color: colors.fg,
      },
      '.cm-panels': { backgroundColor: colors.line, color: colors.fg },
    },
    { dark: colors.dark },
  )

  return [theme, syntaxHighlighting(highlight)]
}

// "Tomorrow" (light) palette.
const tomorrowColors = {
  bg: '#ffffff',
  fg: '#4d4d4c',
  selection: '#c3d7f2',
  line: '#f2f2f2',
  comment: '#8e908c',
  red: '#c82829',
  orange: '#f5871f',
  yellow: '#c99a00',
  green: '#718c00',
  aqua: '#3e999f',
  blue: '#4271ae',
  purple: '#8959a8',
  subtle: '#969896',
  gutterBg: '#f7f8fa',
  gutterBorder: '#eceef1',
  gutterText: '#aab0b8',
  activeLineBg: 'rgba(15, 23, 42, 0.05)',
  dark: false,
}

// "Yesterday" (dark) palette.
const yesterdayColors = {
  bg: '#1d1f21',
  fg: '#c5c8c6',
  selection: '#3d4a5f',
  line: '#282a2e',
  comment: '#969896',
  red: '#cc6666',
  orange: '#de935f',
  yellow: '#f0c674',
  green: '#b5bd68',
  aqua: '#8abeb7',
  blue: '#81a2be',
  purple: '#b294bb',
  subtle: '#b4b7b4',
  gutterBg: '#212427',
  gutterBorder: '#2f3337',
  gutterText: '#5f6672',
  activeLineBg: 'rgba(197, 200, 198, 0.08)',
  dark: true,
}

export const tomorrowTheme = createTheme(tomorrowColors)
export const yesterdayTheme = createTheme(yesterdayColors)
