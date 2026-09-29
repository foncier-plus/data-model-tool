import YAML from 'yaml'

export function yamlDiagnostics(text) {
  let docs = []
  try {
    docs = YAML.parseAllDocuments(text ?? '')
  } catch (error) {
    return [{ severity: 'error', message: error.message, line: null, col: null }]
  }
  const items = []
  for (const doc of docs) {
    for (const error of doc.errors) {
      const position = error.linePos?.[0]
      items.push({
        severity: 'error',
        message: error.message,
        line: position?.line ?? null,
        col: position?.col ?? null,
        pos: error.pos?.[0] ?? 0,
      })
    }
  }
  return items
}
