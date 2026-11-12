// Imagen Open Graph 1200×630 generada con next/og (BLG-05) cuando la entrada no trae una propia.
import { ImageResponse } from 'next/og'
import { getPost } from '../../../../lib/posts'
import { BRAND, SITE_NAME } from '../../../../lib/site'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Portada del artículo del blog de Rutas Libres'

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  const title = post?.title ?? SITE_NAME
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, color: '#fff', background: `radial-gradient(circle at 85% 20%, ${BRAND.coral}99, transparent 45%), linear-gradient(160deg, ${BRAND.primary}, ${BRAND.ink})` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 30, fontWeight: 800 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: BRAND.primary, border: '2px solid rgba(255,255,255,.4)' }} />
          Rutas Libres<span style={{ color: BRAND.coral, fontSize: 20, marginLeft: 4 }}>.PE</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {post?.kicker ? <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: '#85F8C4' }}>{post.kicker}</div> : null}
          <div style={{ fontSize: title.length > 60 ? 56 : 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, opacity: 0.85 }}>
          <span>{post?.author?.name ?? ''}</span>
          <span>{post?.readingMinutes ? `${post.readingMinutes} min de lectura` : ''}</span>
        </div>
      </div>
    ),
    size,
  )
}
