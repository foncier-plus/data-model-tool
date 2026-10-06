import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/i18n'
import { useProjectStore } from '@/lib/store/useProjectStore'
import { BlurInput, FieldRow, MarkdownField, TypeField } from './fields'
import { DocumentationField } from './DocumentationField'
import { OriginForm } from './OriginForm'

export function AttributeForm({ entry, entries, groupIndex, attributeIndex, attribute, resetKey }) {
  const { t } = useTranslation()
  const setAttributeField = useProjectStore((state) => state.setAttributeField)

  const entryId = entry.qualifiedName

  return (
    <div className="flex flex-col gap-4">
      <FieldRow label={t('field.name')}>
        <BlurInput
          value={attribute.name}
          onCommit={(next) => setAttributeField(entryId, groupIndex, attributeIndex, 'name', next)}
        />
      </FieldRow>

      <FieldRow label={t('field.type')}>
        <TypeField
          label={null}
          value={attribute.type}
          onChange={(value) =>
            setAttributeField(entryId, groupIndex, attributeIndex, 'type', value)
          }
        />
      </FieldRow>

      <FieldRow label={t('field.presence')}>
        <Select
          value={attribute.optional ? 'optional' : 'mandatory'}
          onValueChange={(value) =>
            setAttributeField(
              entryId,
              groupIndex,
              attributeIndex,
              'optional',
              value === 'optional',
            )
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mandatory">{t('field.presence.mandatory')}</SelectItem>
            <SelectItem value="optional">{t('field.presence.optional')}</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label={t('field.example')}>
        <Input
          className="italic"
          value={attribute.example ?? ''}
          placeholder={t('field.example.placeholder')}
          onChange={(event) =>
            setAttributeField(entryId, groupIndex, attributeIndex, 'example', event.target.value)
          }
          onBlur={(event) =>
            setAttributeField(entryId, groupIndex, attributeIndex, 'example', event.target.value)
          }
        />
      </FieldRow>

      <MarkdownField
        label={t('field.description')}
        value={attribute.description}
        onChange={(value) =>
          setAttributeField(entryId, groupIndex, attributeIndex, 'description', value)
        }
      />

      <DocumentationField
        value={attribute.about}
        yamlFileName={entry.fileName}
        onChange={(value) =>
          setAttributeField(entryId, groupIndex, attributeIndex, 'about', value)
        }
      />

      <OriginForm
        origin={attribute.origin}
        entries={entries}
        namespace={entry.namespace ?? null}
        resetKey={resetKey}
        onChange={(origin) =>
          setAttributeField(entryId, groupIndex, attributeIndex, 'origin', origin)
        }
      />
    </div>
  )
}
