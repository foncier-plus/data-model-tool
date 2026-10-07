import { useMemo } from 'react'
import { YamlEditor } from '@/components/editor/YamlEditor'
import { parseProjectManifest, resolveProjectPatterns } from '@/lib/model/projectManifest'
import { prettifyFile } from '@/lib/model/prettify'
import { useTranslation } from '@/lib/i18n'

function projectErrorMessage(error, t) {
  switch (error.code) {
    case 'notObject':
      return t('project.error.notObject')
    case 'titleRequired':
      return t('project.error.titleRequired')
    case 'includeInvalid':
      return t('project.error.includeInvalid')
    case 'excludeInvalid':
      return t('project.error.excludeInvalid')
    case 'includeNoMatch':
      return t('project.error.includeNoMatch', { pattern: error.pattern })
    case 'excludeNoMatch':
      return t('project.error.excludeNoMatch', { pattern: error.pattern })
    default:
      return error.message ?? error.code
  }
}

export function ProjectEditor({ fileName, text, onChange, entries }) {
  const { t } = useTranslation()
  const manifest = useMemo(() => parseProjectManifest(fileName, text), [fileName, text])
  const resolved = useMemo(
    () => resolveProjectPatterns(entries, manifest.include, manifest.exclude),
    [entries, manifest],
  )
  const diagnostics = useMemo(
    () =>
      [...manifest.errors, ...resolved.errors].map((error) => ({
        severity: 'error',
        message: projectErrorMessage(error, t),
      })),
    [manifest, resolved, t],
  )
  const prettify = () => onChange(prettifyFile(text))

  return (
    <YamlEditor value={text} onChange={onChange} diagnostics={diagnostics} onPrettify={prettify} />
  )
}
