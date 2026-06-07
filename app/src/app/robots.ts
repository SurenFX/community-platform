import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/ranking', '/u/'],
      disallow: ['/dashboard/', '/admin/', '/api/'],
    },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://salchineta.com'}/sitemap.xml`,
  }
}
