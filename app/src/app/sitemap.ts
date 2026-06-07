import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://salchineta.com'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profiles } = await supabase
    .from('profiles')
    .select('username, updated_at')
    .order('updated_at', { ascending: false })
    .limit(500)

  const profileUrls: MetadataRoute.Sitemap = (profiles ?? []).map((p: any) => ({
    url:          `${base}/u/${encodeURIComponent(p.username)}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  return [
    { url: base,              lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/ranking`, lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/login`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    ...profileUrls,
  ]
}
