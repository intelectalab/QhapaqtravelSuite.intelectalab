// IndexNow (BLG-06): avisa a Bing, Yandex y Seznam de las URL nuevas o cambiadas. Google usa el sitemap.
// La clave se publica en /<INDEXNOW_KEY>.txt (route handler o archivo en public/).
import { SITE_URL } from './site'

export async function pingIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY
  if (!key || !urls.length || process.env.NODE_ENV !== 'production') return
  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: new URL(SITE_URL).host, key, keyLocation: `${SITE_URL}/${key}.txt`, urlList: urls }),
      signal: AbortSignal.timeout(4000),
    })
  } catch {
    // Sin reintento: el sitemap cubre el caso.
  }
}
