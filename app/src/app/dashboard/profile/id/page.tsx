import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import {
  getLevelColor, getLevelTitle, levelProgress,
  formatNumber, getBadgeTierColor
} from '@/lib/utils'
import {
  Flame, Zap, MessageSquare, Tv,
  Youtube, Ticket, User, Edit2
} from 'lucide-react'
import ProfileEditButton from '@/components/profile/ProfileEditButton'

interface ProfilePageProps {
  params: Promise<{ id: string }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id }  = await params
  const supabase = await createClient()

  const [profileRes, { data: { user } }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, user_reputation(*), user_badges(*, badges(*))')
      .eq('id', id)
      .single(),
    supabase.auth.getUser(),
  ])

  if (!profileRes.data) notFound()

  const profile = profileRes.data
  const rep     = profile.user_reputation
  const level   = rep?.level ?? 1
  const progress = levelProgress(rep?.total_xp ?? 0)
  const isOwner  = user?.id === id

  const platformStats = [
    { label: 'Mensajes Discord', value: rep?.discord_messages ?? 0,  icon: MessageSquare, color: 'text-indigo-400',  bg: 'bg-indigo-400/10' },
    { label: 'Min. en stream',   value: rep?.twitch_minutes ?? 0,    icon: Tv,             color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { label: 'Comentarios YT',   value: rep?.youtube_comments ?? 0,  icon: Youtube,        color: 'text-red-400',    bg: 'bg-red-400/10' },
    { label: 'Tickets sorteo',   value: rep?.raffle_tickets ?? 0,    icon: Ticket,         color: 'text-green-400',  bg: 'bg-green-400/10' },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-20 h-20 rounded-2xl"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-primary/20 border border-primary/20 flex items-center justify-center">
                <User className="w-10 h-10 text-primary" />
              </div>
            )}
            {/* Badge de nivel */}
            <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-card border border-border text-xs font-bold text-foreground">
              {level}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground">{profile.username}</h1>
                  {profile.is_admin && (
                    <span className="text-[10px] bg-amber-400/15 text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                      ADMIN
                    </span>
                  )}
                </div>
                <p className={`text-sm font-semibold mt-0.5 ${getLevelColor(level)}`}>
                  {getLevelTitle(level)} · Nivel {level}
                </p>
              </div>

              {/* Botón de edición — solo el dueño lo ve */}
              {isOwner && (
                <ProfileEditButton
                  username={profile.username}
                  bio={profile.bio}
                />
              )}
            </div>

            {/* XP Bar */}
            <div className="mt-3 space-y-1">
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full xp-bar rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatNumber(rep?.total_xp ?? 0)} XP total</span>
                <span>{Math.round(progress)}% al próximo nivel</span>
              </div>
            </div>

            {profile.bio && (
              <p className="text-sm text-muted-foreground mt-3">{profile.bio}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats por plataforma */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {platformStats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className={`inline-flex p-2 rounded-lg ${bg} mb-2`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-xl font-bold text-foreground">{formatNumber(value)}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* XP semanal y mensual */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-400/10">
            <Zap className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{formatNumber(rep?.weekly_xp ?? 0)}</p>
            <p className="text-xs text-muted-foreground">XP esta semana</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-400/10">
            <Zap className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{formatNumber(rep?.monthly_xp ?? 0)}</p>
            <p className="text-xs text-muted-foreground">XP este mes</p>
          </div>
        </div>
      </div>

      {/* Racha */}
      <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-400/10">
            <Flame className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Racha actual</p>
            <p className="text-xs text-muted-foreground">
              Mejor racha: {rep?.longest_streak ?? 0} días
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-extrabold text-orange-400">{rep?.current_streak ?? 0}</p>
          <p className="text-xs text-muted-foreground">días</p>
        </div>
      </div>

      {/* Badges */}
      {profile.user_badges && profile.user_badges.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Badges ({profile.user_badges.length})
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {profile.user_badges.map(({ badges: badge, earned_at }: {
              badges: { name: string; description: string; image_url: string; tier: string } | null
              earned_at: string
            }) => {
              if (!badge) return null
              return (
                <div
                  key={earned_at}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl bg-secondary/50 border ${getBadgeTierColor(badge.tier).split(' ')[1]} border-opacity-30`}
                  title={badge.description}
                >
                  <img src={badge.image_url} alt={badge.name} className="w-8 h-8" />
                  <p className="text-[10px] font-medium text-center text-foreground leading-tight">
                    {badge.name}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pb-4">
        Miembro desde {new Date(profile.created_at).toLocaleDateString('es-AR', {
          year: 'numeric', month: 'long', day: 'numeric'
        })}
      </p>
    </div>
  )
}
