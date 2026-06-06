export const dynamic = 'force-dynamic'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Trophy, ChevronLeft, Tv, Youtube, Ticket } from 'lucide-react'
import { timeAgo } from '@/lib/utils'

type RaffleSource = 'platform' | 'twitch' | 'youtube'

interface UnifiedEntry {
  id:           string
  source:       RaffleSource
  title:        string
  winnerName:   string
  winnerAvatar: string | null
  winnerLink:   string | null
  detail:       string | null
  participants: number | null
  drawnAt:      string
}

export default async function AdminRaffleHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single() as any
  if (!profile?.is_admin) redirect('/dashboard')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // ── 1. Sorteos de plataforma ─────────────────────────────────────────────
  const { data: platformRaffles } = await admin
    .from('raffles')
    .select('id, title, prize, ends_at, winner_id')
    .eq('status', 'DRAWN')
    .order('ends_at', { ascending: false })
    .limit(50)

  const platformWinnerIds = [...new Set((platformRaffles ?? []).map((r: any) => r.winner_id).filter(Boolean))]
  const { data: platformWinners } = platformWinnerIds.length > 0
    ? await admin.from('profiles').select('id, username, avatar_url').in('id', platformWinnerIds)
    : { data: [] }
  const platformWinnerMap = new Map((platformWinners ?? []).map((p: any) => [p.id, p]))

  // Count participantes por sorteo de plataforma
  const { data: pools } = await admin.from('raffle_pools').select('raffle_id')
  const poolCount: Record<string, number> = {}
  for (const p of pools ?? []) {
    poolCount[(p as any).raffle_id] = (poolCount[(p as any).raffle_id] ?? 0) + 1
  }

  const platformEntries: UnifiedEntry[] = (platformRaffles ?? []).map((r: any) => {
    const w = platformWinnerMap.get(r.winner_id)
    return {
      id:           r.id,
      source:       'platform',
      title:        r.title,
      winnerName:   w?.username ?? 'Sin ganador',
      winnerAvatar: w?.avatar_url ?? null,
      winnerLink:   w ? `/dashboard/profile/${w.username}` : null,
      detail:       r.prize,
      participants: poolCount[r.id] ?? null,
      drawnAt:      r.ends_at,
    }
  })

  // ── 2. Sorteos de Twitch ─────────────────────────────────────────────────
  const { data: twitchRaffles } = await admin
    .from('twitch_raffles')
    .select('id, keyword, winner_twitch_username, winner_id, drawn_at')
    .eq('status', 'drawn')
    .order('drawn_at', { ascending: false })
    .limit(50)

  // Contar participantes por sorteo de Twitch
  const { data: twitchEntries } = await admin
    .from('twitch_raffle_entries')
    .select('raffle_id')
  const twitchCount: Record<string, number> = {}
  for (const e of twitchEntries ?? []) {
    twitchCount[(e as any).raffle_id] = (twitchCount[(e as any).raffle_id] ?? 0) + 1
  }

  // Winner de Twitch puede o no estar en nuestra plataforma
  const twitchPlatformWinnerIds = [...new Set((twitchRaffles ?? []).map((r: any) => r.winner_id).filter(Boolean))]
  const { data: twitchWinners } = twitchPlatformWinnerIds.length > 0
    ? await admin.from('profiles').select('id, username, avatar_url').in('id', twitchPlatformWinnerIds)
    : { data: [] }
  const twitchWinnerMap = new Map((twitchWinners ?? []).map((p: any) => [p.id, p]))

  const twitchEntryList: UnifiedEntry[] = (twitchRaffles ?? []).map((r: any) => {
    const platformUser = twitchWinnerMap.get(r.winner_id)
    return {
      id:           r.id,
      source:       'twitch',
      title:        `Sorteo Twitch — keyword: ${r.keyword}`,
      winnerName:   r.winner_twitch_username ?? 'Sin ganador',
      winnerAvatar: platformUser?.avatar_url ?? null,
      winnerLink:   platformUser ? `/dashboard/profile/${platformUser.username}` : null,
      detail:       platformUser ? `@${r.winner_twitch_username} (registrado)` : `@${r.winner_twitch_username}`,
      participants: twitchCount[r.id] ?? null,
      drawnAt:      r.drawn_at,
    }
  })

  // ── 3. Sorteos de YouTube ────────────────────────────────────────────────
  const { data: ytRaffles } = await admin
    .from('youtube_raffles')
    .select('*')
    .order('drawn_at', { ascending: false })
    .limit(50)

  const ytEntries: UnifiedEntry[] = (ytRaffles ?? []).map((r: any) => ({
    id:           r.id,
    source:       'youtube',
    title:        r.video_title ? `Sorteo YouTube — ${r.video_title}` : 'Sorteo YouTube',
    winnerName:   r.winner_youtube_name,
    winnerAvatar: r.winner_photo_url ?? null,
    winnerLink:   r.winner_comment_url ?? null,
    detail:       r.winner_comment ? `"${r.winner_comment.slice(0, 80)}${r.winner_comment.length > 80 ? '…' : ''}"` : null,
    participants: r.total_participants ?? null,
    drawnAt:      r.drawn_at,
  }))

  // ── Unificar y ordenar por fecha ─────────────────────────────────────────
  const all: UnifiedEntry[] = [
    ...platformEntries,
    ...twitchEntryList,
    ...ytEntries,
  ].sort((a, b) => new Date(b.drawnAt).getTime() - new Date(a.drawnAt).getTime())

  // ── Render ───────────────────────────────────────────────────────────────
  const SOURCE_CONFIG: Record<RaffleSource, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
    platform: { label: 'Plataforma', icon: Ticket,  color: 'text-primary',    bg: 'bg-primary/10',    border: 'border-primary/30' },
    twitch:   { label: 'Twitch',     icon: Tv,      color: 'text-[#9146FF]',  bg: 'bg-[#9146FF]/10',  border: 'border-[#9146FF]/30' },
    youtube:  { label: 'YouTube',    icon: Youtube,  color: 'text-red-400',   bg: 'bg-red-400/10',    border: 'border-red-400/30' },
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/raffles" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historial de sorteos</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Todos los sorteos realizados — plataforma, Twitch y YouTube
          </p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        {(['platform', 'twitch', 'youtube'] as RaffleSource[]).map(src => {
          const cfg   = SOURCE_CONFIG[src]
          const Icon  = cfg.icon
          const count = all.filter(e => e.source === src).length
          return (
            <div key={src} className={`bg-card border ${cfg.border} rounded-xl p-4 text-center`}>
              <div className={`inline-flex p-2 rounded-lg ${cfg.bg} mb-2`}>
                <Icon className={`w-4 h-4 ${cfg.color}`} />
              </div>
              <p className="text-xl font-black text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{cfg.label}</p>
            </div>
          )
        })}
      </div>

      {all.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-semibold mb-1">Sin sorteos realizados</p>
          <p className="text-sm text-muted-foreground">Los sorteos finalizados aparecerán acá.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {all.map(entry => {
            const cfg  = SOURCE_CONFIG[entry.source]
            const Icon = cfg.icon
            return (
              <div key={`${entry.source}-${entry.id}`}
                className={`bg-card border ${cfg.border} rounded-2xl p-5`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`shrink-0 p-1.5 rounded-lg ${cfg.bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{entry.title}</p>
                      {entry.detail && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.detail}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(entry.drawnAt)}</span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  {/* Ganador */}
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
                    {entry.winnerAvatar ? (
                      <img src={entry.winnerAvatar} alt={entry.winnerName}
                        className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {entry.winnerName[0]?.toUpperCase()}
                        </span>
                      </div>
                    )}
                    {entry.winnerLink ? (
                      <Link
                        href={entry.winnerLink}
                        target={entry.source === 'youtube' ? '_blank' : undefined}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        {entry.winnerName}
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold text-foreground">{entry.winnerName}</span>
                    )}
                  </div>

                  {/* Participantes */}
                  {entry.participants != null && entry.participants > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {entry.participants} participante{entry.participants !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
