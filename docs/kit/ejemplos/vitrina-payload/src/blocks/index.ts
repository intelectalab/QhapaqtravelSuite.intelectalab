// Bloques que el redactor inserta dentro del contenido (editor Lexical, BlocksFeature).
// Cada bloque tiene su componente en src/components/blocks.tsx y su equivalente visual en el prototipo (vitrina.js › vPost).
import type { Block } from 'payload'

/** Tours de la vitrina incrustados en la entrada. Guarda solo slugs: precio, horarios y reseñas se leen
 *  en el render desde GET /api/v1/showcase/listings?slugs= (spec 24 §13.1). Nunca copia precios a Payload. */
export const ToursRecomendados: Block = {
  slug: 'toursRecomendados',
  interfaceName: 'ToursRecomendadosBlock',
  labels: { singular: 'Tours recomendados', plural: 'Tours recomendados' },
  fields: [
    { name: 'heading', type: 'text', label: 'Título opcional', localized: true },
    {
      name: 'tours',
      type: 'array',
      label: 'Tours',
      minRows: 1,
      maxRows: 6,
      fields: [
        { name: 'slug', type: 'text', required: true, label: 'Slug del tour en la vitrina', admin: { description: 'Ej.: centro-historico-de-lima-gratis' } },
      ],
    },
    { name: 'layout', type: 'select', defaultValue: 'inline', options: [{ label: 'Tarjeta horizontal', value: 'inline' }, { label: 'Cuadrícula', value: 'grid' }] },
  ],
}

export const Consejo: Block = {
  slug: 'consejo',
  interfaceName: 'ConsejoBlock',
  labels: { singular: 'Consejo', plural: 'Consejos' },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'text', type: 'textarea', required: true, localized: true },
    { name: 'tone', type: 'select', defaultValue: 'tip', options: [{ label: 'Consejo (verde)', value: 'tip' }, { label: 'Aviso (coral)', value: 'warning' }] },
  ],
}

export const Cita: Block = {
  slug: 'cita',
  interfaceName: 'CitaBlock',
  labels: { singular: 'Cita', plural: 'Citas' },
  fields: [
    { name: 'quote', type: 'textarea', required: true, localized: true },
    { name: 'author', type: 'text', required: true },
  ],
}

export const Faq: Block = {
  slug: 'faq',
  interfaceName: 'FaqBlock',
  labels: { singular: 'Preguntas frecuentes', plural: 'Preguntas frecuentes' },
  fields: [
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      fields: [
        { name: 'question', type: 'text', required: true, localized: true },
        { name: 'answer', type: 'textarea', required: true, localized: true },
      ],
    },
  ],
}

export const Cta: Block = {
  slug: 'cta',
  interfaceName: 'CtaBlock',
  labels: { singular: 'Llamado a la acción', plural: 'Llamados a la acción' },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'text', type: 'textarea', localized: true },
    { name: 'label', type: 'text', required: true, localized: true },
    { name: 'href', type: 'text', required: true, admin: { description: 'Ruta interna (/lima, /agencias) o URL completa.' } },
    { name: 'variant', type: 'select', defaultValue: 'booking', options: [{ label: 'Reservar (coral)', value: 'booking' }, { label: 'Agencias (cobalto)', value: 'agency' }] },
  ],
}

export const Galeria: Block = {
  slug: 'galeria',
  interfaceName: 'GaleriaBlock',
  labels: { singular: 'Galería', plural: 'Galerías' },
  fields: [
    {
      name: 'images',
      type: 'array',
      minRows: 2,
      maxRows: 8,
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'caption', type: 'text', localized: true },
      ],
    },
  ],
}

export const MapaRuta: Block = {
  slug: 'mapaRuta',
  interfaceName: 'MapaRutaBlock',
  labels: { singular: 'Mapa de la ruta', plural: 'Mapas de ruta' },
  fields: [
    { name: 'title', type: 'text', localized: true },
    {
      name: 'stops',
      type: 'array',
      minRows: 2,
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'point', type: 'point', required: true },
        { name: 'minutes', type: 'number', min: 0, admin: { description: 'Minutos a pie desde la parada anterior' } },
      ],
    },
  ],
}

export const POST_BLOCKS: Block[] = [ToursRecomendados, Consejo, Cita, Faq, Cta, Galeria, MapaRuta]
