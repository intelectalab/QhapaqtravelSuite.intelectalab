// Colecciones de apoyo del blog: categorías (anidadas), ciudades, etiquetas y autores.
import type { CollectionConfig } from 'payload'
import { anyone, seoAndUp, editorsAndUp, isAdmin } from '../access/roles'
import { slugField } from '../fields/slug'

/** Categorías con jerarquía (plugin nested-docs agrega `parent` y `breadcrumbs`). URL: /blog/categoria/<ruta>. */
export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'Categoría', plural: 'Categorías' },
  admin: { useAsTitle: 'name', group: 'Blog' },
  access: { read: anyone, create: seoAndUp, update: seoAndUp, delete: isAdmin },
  fields: [
    { name: 'name', type: 'text', required: true, localized: true },
    { name: 'description', type: 'textarea', localized: true, maxLength: 160, admin: { description: 'Se usa como meta descripción de la página de la categoría.' } },
    slugField('name'),
  ],
}

/** Ciudades: el `slug` coincide con el `id` de ciudad de la vitrina en KipuControl (lima, cusco, arequipa, puno). */
export const Cities: CollectionConfig = {
  slug: 'cities',
  labels: { singular: 'Ciudad', plural: 'Ciudades' },
  admin: { useAsTitle: 'name', group: 'Blog' },
  access: { read: anyone, create: isAdmin, update: seoAndUp, delete: isAdmin },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'zones', type: 'text', hasMany: true, admin: { description: 'Zonas que se usan como filtros en /<ciudad>.' } },
    { name: 'tone', type: 'select', defaultValue: 'lima', options: ['lima', 'cusco', 'arequipa', 'puno'].map((v) => ({ label: v, value: v })), admin: { description: 'Degradado de respaldo cuando no hay foto.' } },
  ],
}

export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: { singular: 'Etiqueta', plural: 'Etiquetas' },
  admin: { useAsTitle: 'name', group: 'Blog' },
  access: { read: anyone, create: seoAndUp, update: seoAndUp, delete: seoAndUp },
  fields: [{ name: 'name', type: 'text', required: true, localized: true }, slugField('name')],
}

/** Autores públicos (E-E-A-T). No son usuarios del panel: un usuario puede enlazarse a su ficha de autor. */
export const Authors: CollectionConfig = {
  slug: 'authors',
  labels: { singular: 'Autor', plural: 'Autores' },
  admin: { useAsTitle: 'name', group: 'Blog' },
  access: { read: anyone, create: editorsAndUp, update: editorsAndUp, delete: isAdmin },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'role', type: 'text', localized: true, label: 'Cargo o especialidad', admin: { description: 'Ej.: Historiadora sanmarquina · redactora de rutas urbanas' } },
    { name: 'bio', type: 'textarea', localized: true, maxLength: 400 },
    { name: 'avatar', type: 'upload', relationTo: 'media' },
    { name: 'verified', type: 'checkbox', defaultValue: false, label: 'Guía oficial verificado (carné MINCETUR)' },
    { name: 'sameAs', type: 'text', hasMany: true, label: 'Perfiles públicos (LinkedIn, Instagram…)', admin: { description: 'Van a `author.sameAs` en el JSON-LD.' } },
  ],
}
