// Campo `slug` reutilizable: se genera del título, en minúsculas, sin tildes ni signos, y es único.
// El cambio de slug de una entrada publicada crea una redirección 301 (hook slugRedirect, regla BLG-04).
import type { Field, FieldHook } from 'payload'

export const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)

const formatSlug =
  (fallback: string): FieldHook =>
  ({ value, data, originalDoc }) => {
    if (typeof value === 'string' && value.trim()) return slugify(value)
    const source = (data?.[fallback] ?? originalDoc?.[fallback]) as string | undefined
    return source ? slugify(source) : value
  }

export const slugField = (fallback = 'title'): Field => ({
  name: 'slug',
  type: 'text',
  label: 'Slug (URL)',
  index: true,
  unique: true,
  required: true,
  admin: {
    position: 'sidebar',
    description: 'Se genera del título. Debe contener la palabra clave (BLG-01). Cambiarlo en una entrada publicada crea una redirección 301.',
  },
  validate: (val: unknown) =>
    typeof val === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(val) ? true : 'Use solo minúsculas, números y guiones.',
  hooks: { beforeValidate: [formatSlug(fallback)] },
})
