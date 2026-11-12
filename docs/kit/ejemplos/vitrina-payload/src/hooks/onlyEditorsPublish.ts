// El rol `autor` guarda borradores y pide revisión; publicar, programar o despublicar es del editor (spec 24 §7).
import { Forbidden, type CollectionBeforeChangeHook } from 'payload'
import { hasRole } from '../access/roles'

export const onlyEditorsPublish: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  const changesPublication = data._status === 'published' || (originalDoc?._status === 'published' && data._status === 'draft')
  if (changesPublication && req.user && !hasRole(req, 'editor')) throw new Forbidden(req.t)
  return data
}
