export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, User } from 'lucide-react'
import { getLevelColor, getLevelTitle } from '@/lib/utils'

export default async function ComunidadPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [membersRes, totalRes] = await Promise.all([
    admin
      .from('user_reputation')
      .select('user_id, total_xp, level, profiles!inner(username, avatar_url)')
      .order('total_xp', { ascending: false })
      .limit(50),
    admin.from('profiles').select('id', { count: 'exact', head: true }),
  ])

  const members = membersRes.data ?? []
  const userIds = members.map((m: any) => m.user_id)

  const { data: allEarned } = await admin
    .from('user_badges')
    .select('user_id, badges(image_url, name)')
    .in('user_id', userIds)

  const badgesByUser: Record<string, any[]> = {}
  for (const ub of allEarned ?? []) {
    if (!badgesByUser[(ub as any).user_id]) badgesByUser[(ub as any).user_id] = []
    if ((ub as any).badges) badgesByUser[(ub as any).user_id].push((ub as any).badges)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comunidad</h1>
          <p className="text-muted-foreground mt-1 text-sm">Todos los miembros activos</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-2.5 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">{totalRes.count ?? 0}</span>
          <span className="text-xs text-muted-foreground">miembros</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((entry: any) => {
          const profile  = entry.profiles
          const isMe     = entry.user_id === user.id
          const badges   = badgesByUser[entry.user_id] ?? []
          const username = profile?.username ?? entry.user_id

          return (
            <Link
              key={entry.user_id}
              href={`/dashboard/profile/${encodeURIComponent(username)}`}
              className={`bg-card border rounded-2xl p-4 hover:border-primary/40 transition-all duration-200 space-y-3 ${
                isMe ? 'border-primary/30 bg-primary/5' : 'border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={username} className="w-11 h-11 rounded-xl shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-foreground truncate">{username}</p>
                    {isMe && (
                      <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium shrink-0">Tú</span>
                    )}
                  </div>
                  <p className={`text-xs font-medium ${getLevelColor(entry.level)}`}>
                    Nv. {entry.level} · {getLevelTitle(entry.level)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">{entry.total_xp.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">XP</p>
                </div>
              </div>

              {badges.length > 0 ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {badges.slice(0, 8).map((badge: any, i: number) => (
                    <span key={i} title={badge.name} className="text-lg leading-none">
                      {badge.image_url ?? '🏅'}
                    </span>
                  ))}
                  {badges.length > 8 && (
                    <span className="text-xs text-muted-foreground ml-1">+{badges.length - 8}</span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin badges aún</p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
