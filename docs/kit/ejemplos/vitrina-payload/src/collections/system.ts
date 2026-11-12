// Media (S3 con texto alternativo obligatorio), páginas estáticas y usuarios del panel.
import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { anyone, isAdmin, isLoggedIn, editorsAndUp, publishedOrLoggedIn, adminField } from '../access/roles'
import { slugField } from '../fields/slug'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Imagen', plural: 'Imágenes' },
  admin: { group: 'Blog' },
  access: { read: anyone, create: isLoggedIn, update: isLoggedIn, delete: editorsAndUp },
  upload: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    focalPoint: true,
    // Tamaños que usa la vitrina: tarjetas 4:3, portada 16:8 y Open Graph 1200×630.
    imageSizes: [
      { name: 'card', width: 640, height: 480, position: 'centre', formatOptions: { format: 'webp', options: { quality: 78 } } },
      { name: 'cover', width: 1600, height: 800, position: 'centre', formatOptions: { format: 'webp', options: { quality: 80 } } },
      { name: 'og', width: 1200, height: 630, position: 'centre', formatOptions: { format: 'jpeg', options: { quality: 82 } } },
    ],
    adminThumbnail: 'card',
  },
  fields: [
    { name: 'alt', type: 'text', required: true, localized: true, label: 'Texto alternativo', minLength: 8, admin: { description: 'Describe la foto (BLG-01). No escriba «imagen de…».' } },
    { name: 'credit', type: 'text', label: 'Crédito', defaultValue: 'Archivo Rutas Libres' },
    { name: 'ownPhoto', type: 'checkbox', defaultValue: true, label: 'Foto propia o con licencia', required: true },
  ],
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Página', plural: 'Páginas' },
  admin: { useAsTitle: 'title', group: 'Sitio' },
  access: { read: publishedOrLoggedIn, create: editorsAndUp, update: editorsAndUp, delete: isAdmin },
  versions: { drafts: { autosave: true } },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField('title'),
    { name: 'content', type: 'richText', localized: true, editor: lexicalEditor({}) },
  ],
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Usuario del panel', plural: 'Usuarios del panel' },
  auth: { tokenExpiration: 60 * 60 * 8, maxLoginAttempts: 5, lockTime: 15 * 60 * 1000 },
  admin: { useAsTitle: 'email', group: 'Sitio' },
  access: { read: isLoggedIn, create: isAdmin, update: ({ req, id }) => req.user?.id === id || isAdmin({ req }), delete: isAdmin },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'autor',
      saveToJWT: true,
      access: { update: adminField },
      options: [
        { label: 'Autor (escribe, no publica)', value: 'autor' },
        { label: 'Editor (publica y programa)', value: 'editor' },
        { label: 'SEO (metadatos, categorías y redirecciones)', value: 'seo' },
        { label: 'Administrador', value: 'admin' },
      ],
    },
    { name: 'author', type: 'relationship', relationTo: 'authors', label: 'Ficha pública de autor' },
  ],
}
