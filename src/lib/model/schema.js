import { z } from 'zod'

export const ATTRIBUTE_TYPES = [
  'string',
  'number',
  'integer',
  'boolean',
  'date',
  'datetime',
  'enum',
  'ref',
  'array',
]

const name = z.string().min(1)
const about = z.string().default('')
const namespace = z.string().default('')

export const originSchema = z.object({
  from: z.array(z.string()).default([]),
  formula: z.string().default(''),
})

export const PRESENCE_VALUES = ['mandatory', 'optional']

export const attributeSchema = z.object({
  name,
  type: z.string().optional(),
  presence: z.string().default(''),
  optional: z.boolean().default(false),
  example: z.string().default(''),
  description: z.string().default(''),
  about,
  comment: z.string().default(''),
  origin: originSchema.optional(),
})

export const groupSchema = z.object({
  name,
  description: z.string().default(''),
  comment: z.string().default(''),
  origin: originSchema.optional(),
  attributes: z.array(attributeSchema).default([]),
})

export const objectSchema = z.object({
  namespace,
  name,
  type: z.string().optional(),
  description: z.string().default(''),
  about,
  comment: z.string().default(''),
  attributes: z.array(attributeSchema).default([]),
  groups: z.array(groupSchema).default([]),
})

export function validateModel(raw) {
  const result = objectSchema.safeParse(raw)
  if (result.success) {
    return { model: result.data, issues: [] }
  }
  return {
    model: null,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  }
}
