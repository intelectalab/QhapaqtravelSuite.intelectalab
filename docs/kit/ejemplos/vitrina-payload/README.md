# Blog de Rutas Libres en Payload CMS: entradas y SEO (v2.11)

Configuración lista para copiar a `apps/vitrina` (Next.js 15 + Payload 3). Implementa la spec 24 §13.1 y las reglas BLG-01 a BLG-06. Comentarios en español; código en inglés. Diseño: [`../../design/rutaslibres/DESIGN.md`](../../design/rutaslibres/DESIGN.md).

## 1. Qué hay

| Archivo | Qué resuelve |
|---|---|
| `src/payload.config.ts` | Base `rutaslibres_cms` (esquema `payload`, solo migraciones), idiomas es/en/pt, plugins SEO, redirecciones, categorías anidadas y S3. |
| `src/collections/Posts.ts` | La entrada: pestañas **Contenido** y **Relaciones**, pestaña **SEO** del plugin, barra lateral con slug, palabra clave, publicación, noindex, canónica y semáforo. Borradores con autoguardado, publicación programada, 50 versiones y vista previa en vivo (móvil y escritorio). |
| `src/collections/taxonomy.ts` | `categories` (anidadas), `cities` (slug = id de ciudad de la vitrina), `tags`, `authors` (E-E-A-T: cargo, bio, verificado, perfiles). |
| `src/collections/system.ts` | `media` (alt obligatorio, tamaños 4:3, portada y OG en WebP/JPEG), `pages`, `users` con rol. |
| `src/globals/SeoDefaults.ts` | Plantilla de título, descripción e imagen por defecto, organización, verificación de buscadores y rutas bloqueadas en robots. |
| `src/blocks/index.ts` | Bloques del editor: **ToursRecomendados**, Consejo, Cita, Faq, Cta, Galería y MapaRuta. |
| `src/access/roles.ts` | autor · editor · seo · admin. |
| `src/hooks/*` | `seoGuard` (BLG-01/02), `onlyEditorsPublish`, `slugRedirect` (BLG-04), `syncKipu` (BLG-03 + IndexNow), `revalidate` (ISR). |
| `src/lib/seo-rules.ts` | Las reglas SEO como funciones puras; las usa el hook y el panel de KipuControl. |
| `src/lib/jsonld.ts` | `BlogPosting` + `BreadcrumbList` + `FAQPage` en un `@graph` (BLG-05). |
| `src/app/(vitrina)/blog/[slug]/page.tsx` | `generateStaticParams`, `generateMetadata` (canónica, hreflang, robots, Open Graph de artículo), tabla de contenidos, cuerpo con bloques, FAQ, autora y relacionados. |
| `src/app/(vitrina)/blog/[slug]/opengraph-image.tsx` | Imagen OG 1200×630 con `next/og` en los colores de la marca. |
| `src/app/(vitrina)/blog/sitemap.xml/route.ts` | Sitemap del blog con `xhtml:link` por idioma (BLG-06). |
| `src/app/robots.ts` | robots.txt: bloquea `/admin`, `/api`, vistas previas y todo fuera de producción. |

## 2. La entrada, campo por campo

| Campo | Tipo | Regla |
|---|---|---|
| `title` | texto (localizado, ≤ 110) | Único H1. Debe contener la palabra clave. |
| `titleAccent` | texto | Final del título que se pinta en cobalto (diseño Stitch). |
| `kicker` | texto | Antetítulo («Guía de barrio · Lima 2026»). |
| `excerpt` | área de texto (≤ 220) | Entradilla y descripción por defecto. |
| `heroImage` + `heroCaption` | imagen + texto | Alt obligatorio en `media`. |
| `content` | Lexical | H2 a H4 (sin H1) y los 7 bloques. |
| `faq[]` | pregunta y respuesta | Se publica al final y como `FAQPage`. |
| `author`, `categories`, `city`, `tags`, `relatedPosts` | relaciones | Entrada de ciudad = 3 tours como mínimo (BLG-02). |
| `slug` | texto único | Generado del título; cambiarlo en una entrada publicada crea un 301. |
| `focusKeyword` | texto | Debe estar en título, primer párrafo y slug. |
| `meta.title` / `meta.description` / `meta.image` / `meta.ogTitle` | plugin SEO | 30–60 y 70–160 caracteres, con vista previa de Google en el panel. |
| `publishedAt`, `noindex`, `canonicalUrl` | barra lateral | `noindex` solo lo cambian editor y SEO. |
| `wordCount`, `readingMinutes`, `seoScore`, `seoChecks`, `kipuSyncedAt` | calculados | Solo lectura. |

## 3. Cómo se publica

1. El **autor** escribe; el autoguardado crea versiones de borrador y la vista previa en vivo muestra el diseño real.
2. Cada guardado calcula palabras, minutos y el semáforo (`seoChecks`).
3. El **editor** publica o programa. `seoGuard` rechaza la publicación con 422 y la lista de reglas que fallan.
4. Al publicar: revalidación de la entrada, del índice y del sitemap; webhook firmado a KipuControl (`platform_blog_posts`); IndexNow.
5. Si el slug cambia: redirección 301 desde la URL anterior.

## 4. Puesta en marcha

```bash
cp .env.example .env            # completar DATABASE_URI, PAYLOAD_SECRET, KIPU_*, S3_*
npm install
npm run generate:importmap      # componentes del panel
npm run migrate:create init && npm run migrate
npm run generate:types          # crea src/payload-types.ts
npm run dev                     # sitio en :3000, panel en /admin
```

El panel de Payload se monta con `withPayload` (`next.config.mjs`) y las rutas `src/app/(payload)/admin/[[...segments]]` y `src/app/(payload)/api/[...slug]` que genera `npx create-payload-app` (no se copian aquí porque son plantillas fijas de Payload).

Compilación verificada con `tsc --noEmit` usando `payload@3.92.1`, `@payloadcms/*@3.92.1` y `next@15.4.11`.
