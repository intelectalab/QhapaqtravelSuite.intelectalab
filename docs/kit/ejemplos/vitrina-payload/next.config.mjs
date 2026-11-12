// next.config.mjs — withPayload monta el panel en /admin y la API REST de Payload en /api del mismo dominio.
import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: process.env.S3_PUBLIC_HOST ?? 'media.rutaslibres.pe' }] },
  async headers() {
    // El panel no se indexa ni se incrusta en otros sitios.
    return [{ source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'X-Frame-Options', value: 'DENY' }] }]
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
