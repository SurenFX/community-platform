import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const TIER_COLORS: Record<string, string> = {
  BRONZE:    'bg-amber-700/20 text-amber-600 border-amber-700/30',
  SILVER:    'bg-slate-400/20 text-slate-400 border-slate-400/30',
  GOLD:      'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
  LEGENDARY: 'bg-purple-400/20 text-purple-400 border-purple-400/30',
}

const FAMILY_LABELS: Record<string, string> = {
  discord:  '💬 Discord',
  stream:   '🟣 Stream',
  streak:   '🔥 Racha',
  level:    '⭐ Nivel',
  missions: '🎯 Misiones',
  youtube:  '📹 YouTube',
  telegram: '✈️ Telegram',
  special:  '🏅 Especiales',
}

export default async function AdminBadgesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/dashboard')

  const [{ data: badges }, { data: earnedCounts }] = await Promise.all([
    supabase
      .from('badges')
      .select('id, slug, name, description, image_url, tier, family, family_order, is_secret')
      .not('family', 'is', null)
      .order('family')
      .order('family_order'),
    supabase
      .from('user_badges')
      .select('badge_id'),
  ])

  // Contar cuántos usuarios tienen cada badge
  const countMap: Record<string, number> = {}
  for (const ub of earnedCounts ?? []) {
    countMap[ub.badge_id] = (countMap[ub.badge_id] ?? 0) + 1
  }

  const badgesWithCount = (badges ?? []).map(b => ({ ...b, earned_count: countMap[b.id] ?? 0 }))

  // Agrupar por familia
  const byFamily: Record<string, any[]> = {}
  for (const badge of badgesWithCount) {
    const fam = badge.family ?? 'other'
    if (!byFamily[fam]) byFamily[fam] = []
    byFamily[fam].push(badge)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Badges</h1>
        <p className="text-muted-foreground text-sm mt-1">{badgesWithCount.length} badges en total</p>
      </div>

      {Object.entries(byFamily).map(([family, fBadges]) => (
        <div key={family} className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">{FAMILY_LABELS[family] ?? family}</h2>
          </div>
          <div className="divide-y divide-border">
            {fBadges.map((badge: any) => (
              <div key={badge.id} className="flex items-center gap-4 px-6 py-4">
                <span className="text-3xl w-10 text-center">{badge.image_url || '🏅'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-foreground">{badge.name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TIER_COLORS[badge.tier] ?? ''}`}>
                      {badge.tier}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-foreground">{badge.earned_count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">usuarios</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
