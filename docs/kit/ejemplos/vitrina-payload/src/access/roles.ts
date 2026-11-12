// Roles del panel de Payload (spec 24 §13.1). No son roles de KipuControl: solo existen en la base `rutaslibres_cms`.
// autor  → crea y edita sus entradas, nunca publica
// editor → publica, programa y despublica cualquier entrada
// seo    → edita la pestaña SEO, categorías y redirecciones
// admin  → todo, incluidos usuarios y valores SEO por defecto
import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'

export type CmsRole = 'autor' | 'editor' | 'seo' | 'admin'

const roleOf = (req: PayloadRequest): CmsRole | null =>
  ((req.user as { role?: CmsRole } | null)?.role ?? null)

export const hasRole = (req: PayloadRequest, ...roles: CmsRole[]): boolean => {
  const r = roleOf(req)
  return r !== null && (r === 'admin' || roles.includes(r))
}

export const isAdmin: Access = ({ req }) => hasRole(req)
export const isLoggedIn: Access = ({ req }) => Boolean(req.user)
export const editorsAndUp: Access = ({ req }) => hasRole(req, 'editor')
export const seoAndUp: Access = ({ req }) => hasRole(req, 'editor', 'seo')
export const anyone: Access = () => true

// Lectura pública: solo lo publicado. En el panel, cada rol ve todo (los borradores incluidos).
export const publishedOrLoggedIn: Access = ({ req }) => {
  if (req.user) return true
  const onlyPublished: Where = { _status: { equals: 'published' } }
  return onlyPublished
}

// El autor solo edita sus propias entradas; editor, seo y admin editan cualquiera.
export const ownPostsOrEditors: Access = ({ req }) => {
  if (hasRole(req, 'editor', 'seo')) return true
  if (roleOf(req) === 'autor') {
    const mine: Where = { createdBy: { equals: req.user?.id } }
    return mine
  }
  return false
}

// Campos de la pestaña SEO: los ve todo el equipo, los cambian seo, editor y admin… y el autor mientras es borrador.
export const canEditSeoField: FieldAccess = ({ req, doc }) =>
  hasRole(req, 'editor', 'seo') || (roleOf(req) === 'autor' && (doc as { _status?: string } | undefined)?._status !== 'published')

export const adminField: FieldAccess = ({ req }) => hasRole(req)
