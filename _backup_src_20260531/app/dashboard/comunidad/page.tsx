import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Medal, Award, User, Users } from 'lucide-react'

function getLevelColor(level: number): string {
  if (level < 5)  return 'text-gray-400'
  if (level < 10) return 'text-green-400'
  if (level < 20) return 'text-blue-400'
  if (level < 35) return 'text-purple-400'
  if (level < 50) return 'text-yellow-400'
  if (level < 75) return 'text-orange-400'
  return 'text-red-400'
}

function getLevelTitle(level: number): string {
  if (level < 5)  return 'Novato'
  if (level < 10) return 'Activo'
  if (level < 20) return 'Veterano'
  if (level < 35) return 'Experto'
  if (level < 50) return 'Élite'
  if (level < 75) return 'Leyenda'
  return 'Mythic'
}

export default async function ComunidadPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [globalRes, weeklyRes, monthlyRes, totalRes] = await Promise.all([
    supabase
      .from('user_reputation')
      .select('user_id, total_xp, level, profiles!inner(username, avatar_url, discord_tag)')
      .order('total_xp', { ascending: false })
      .limit(20),
    supabase
      .from('user_reputation')
      .select('user_id, weekly_xp, level, profiles!inner(username, avatar_url, discord_tag)')
      .order('weekly_xp', { ascending: false })
      .limit(20),
    supabase
      .from('user_reputation')
      .select('user_id, monthly_xp, level, profiles!inner(username, avatar_url, discord_tag)')
      .order('monthly_xp', { ascending: false })
      .limit(20),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ])

  const rankIcons = [
    <Trophy key={0} className="w-5 h-5 text-yellow-400" />,
    <Medal  key={1} className="w-5 h-5 text-gray-300"   />,
    <Award  key={2} className="w-5 h-5 text-amber-600"  />,
  ]

  const tabs = [
    { id: 'global',  label: 'Global',  data: globalRes.data,  xpField: 'total_xp'  },
    { id: 'weekly',  label: 'Semanal', data: weeklyRes.data,  xpField: 'weekly_xp' },
    { id: 'monthly', label: 'Mensual', data: monthlyRes.data, xpField: 'monthly_xp'},
  ]

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comunidad</h1>
          <p className="text-muted-foreground mt-1 text-sm">Los miembros más activos</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-2.5 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">{totalRes.count ?? 0}</span>
          <span className="text-xs text-muted-foreground">miembros</span>
        </div>
      </div>

      {tabs.map(({ id, label, data, xpField }) => (
        <div key={id} className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">{label}</h2>
          </div>
          <div className="divide-y divide-border">
            {(data ?? []).map((entry: any, i) => {
              const profile = entry.profiles
              const xp      = entry[xpField] ?? 0
              const isMe    = entry.user_id === user.id
              const level   = entry.level ?? 1

              return (
                <Link key={entry.user_id}
                  href={`/dashboard/profile/${encodeURIComponent(profile?.username ?? entry.user_id)}`}
                  className={`flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/30 transition-colors ${isMe ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                >
                  <div className="w-8 flex justify-center shrink-0">
                    {i < 3 ? rankIcons[i] : (
                      <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>
                    )}
                  </div>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.username} className="w-9 h-9 rounded-xl shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {profile?.username ?? 'Usuario'}
                      </p>
                      {isMe && (
                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium shrink-0">Tú</span>
                      )}
                    </div>
                    <p className={`text-xs font-medium ${getLevelColor(level)}`}>
                      {getLevelTitle(level)} · Nv. {level}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-primary shrink-0">
                    {xp.toLocaleString()} XP
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
