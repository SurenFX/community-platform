export const dynamic = 'force-dynamic'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Ticket, ChevronLeft, Tv, Youtube } from 'lucide-react'
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
  iWon:         boolean
  myTickets:    number | null   // solo plataforma
}

export default async function RaffleHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Obtener perfil del usuario (para saber su discord/twitch/youtube)
  const { data: profile } = await admin
    .from('profiles').select('username, avatar_url').eq('id', user.id).single()

  const { data: socialLinks } = await admin
    .from('user_social_links')
    .select('platform, username, external_id')
    .eq('user_id', user.id)

  const twitchUsername = socialLinks?.find((s: any) => s.platform === 'TWITCH')?.username?.toLowerCase() ?? null

  // ── 1. Sorteos de plataforma ─────────────────────────────────────────────
  const { data: platformRaffles } = await admin
    .from('raffles')
    .select('id, title, prize, ends_at, winner_id')
    .eq('status', 'DRAWN')
    .order('ends_at', { ascending: false })
    .limit(30)

  const platformWinnerIds = [...new Set((platformRaffles ?? []).map((r: any) => r.winner_id).filter(Boolean))]
  const { data: platformWinners } = platformWinnerIds.length > 0
    ? await admin.from('profiles').select('id, username, avatar_url').in('id', platformWinnerIds)
    : { data: [] }
  const platformWinnerMap = new Map((platformWinners ?? []).map((p: any) => [p.id, p]))

  const { data: myParticipations } = await admin
    .from('raffle_pools').select('raffle_id, tickets').eq('user_id', user.id)
  const myPoolMap = new Map((myParticipations ?? []).map((p: any) => [p.raffle_id, p.tickets]))

  const { data: pools } = await admin.from('raffle_pools').select('raffle_id')
  const poolCount: Record<string, number> = {}
  for (const p of pools ?? []) poolCount[(p as any).raffle_id] = (poolCount[(p as any).raffle_id] ?? 0) + 1

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
      iWon:         r.winner_id === user.id,
      myTickets:    myPoolMap.get(r.id) ?? null,
    }
  })

  // ── 2. Sorteos de Twitch ─────────────────────────────────────────────────
  const { data: twitchRaffles } = await admin
    .from('twitch_raffles')
    .select('id, keyword, winner_twitch_username, winner_id, drawn_at')
    .eq('status', 'drawn')
    .order('drawn_at', { ascending: false })
    .limit(30)

  const { data: twitchEntryRows } = await admin.from('twitch_raffle_entries').select('raffle_id')
  const twitchCount: Record<string, number> = {}
  for (const e of twitchEntryRows ?? []) twitchCount[(e as any).raffle_id] = (twitchCount[(e as any).raffle_id] ?? 0) + 1

  const twitchPWinnerIds = [...new Set((twitchRaffles ?? []).map((r: any) => r.winner_id).filter(Boolean))]
  const { data: twitchWinnerProfiles } = twitchPWinnerIds.length > 0
    ? await admin.from('profiles').select('id, username, avatar_url').in('id', twitchPWinnerIds)
    : { data: [] }
  const twitchWinnerMap = new Map((twitchWinnerProfiles ?? []).map((p: any) => [p.id, p]))

  const twitchEntries: UnifiedEntry[] = (twitchRaffles ?? []).map((r: any) => {
    const pw = twitchWinnerMap.get(r.winner_id)
    const iWon = r.winner_id === user.id ||
      (twitchUsername && r.winner_twitch_username?.toLowerCase() === twitchUsername)
    return {
      id:           r.id,
      source:       'twitch',
      title:        `Sorteo Twitch — keyword: ${r.keyword}`,
      winnerName:   r.winner_twitch_username ?? 'Sin ganador',
      winnerAvatar: pw?.avatar_url ?? null,
      winnerLink:   pw ? `/dashboard/profile/${pw.username}` : null,
      detail:       null,
      participants: twitchCount[r.id] ?? null,
      drawnAt:      r.drawn_at,
      iWon,
      myTickets:    null,
    }
  })

  // ── 3. Sorteos de YouTube ────────────────────────────────────────────────
  const { data: ytRaffles } = await admin
    .from('youtube_raffles')
    .select('*')
    .order('drawn_at', { ascending: false })
    .limit(30)

  const ytEntries: UnifiedEntry[] = (ytRaffles ?? []).map((r: any) => ({
    id:           r.id,
    source:       'youtube' as RaffleSource,
    title:        r.video_title ? `Sorteo YouTube — ${r.video_title}` : 'Sorteo YouTube',
    winnerName:   r.winner_youtube_name,
    winnerAvatar: r.winner_photo_url ?? null,
    winnerLink:   r.winner_comment_url ?? null,
    detail:       r.winner_comment ? `"${r.winner_comment.slice(0, 80)}${r.winner_comment.length > 80 ? '…' : ''}"` : null,
    participants: r.total_participants ?? null,
    drawnAt:      r.drawn_at,
    iWon:         false, // no hay forma de vincular YouTube con el usuario sin OAuth
    myTickets:    null,
  }))

  // ── Unificar y ordenar ───────────────────────────────────────────────────
  const all: UnifiedEntry[] = [
    ...platformEntries,
    ...twitchEntries,
    ...ytEntries,
  ].sort((a, b) => new Date(b.drawnAt).getTime() - new Date(a.drawnAt).getTime())

  const wonCount = all.filter(e => e.iWon).length

  const SOURCE_CONFIG: Record<RaffleSource, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
    platform: { label: 'Plataforma', icon: Ticket,  color: 'text-primary',   bg: 'bg-primary/10',   border: 'border-primary/20'   },
    twitch:   { label: 'Twitch',     icon: Tv,      color: 'text-[#9146FF]', bg: 'bg-[#9146FF]/10', border: 'border-[#9146FF]/20' },
    youtube:  { label: 'YouTube',    icon: Youtube,  color: 'text-red-400',  bg: 'bg-red-400/10',   border: 'border-red-400/20'   },
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/raffles" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historial de sorteos</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Todos los sorteos realizados en las tres plataformas
            {wonCount > 0 && <span className="text-yellow-400 font-semibold"> · 🏆 Ganaste {wonCount}</span>}
          </p>
        </div>
      </div>

      {all.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-semibold mb-1">Sin sorteos anteriores</p>
          <p className="text-sm text-muted-foreground">Los sorteos finalizados aparecerán acá.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {all.map(entry => {
            const cfg  = SOURCE_CONFIG[entry.source]
            const Icon = cfg.icon
            return (
              <div key={`${entry.source}-${entry.id}`}
                className={`bg-card border rounded-2xl p-5 transition-all ${
                  entry.iWon
                    ? 'border-yellow-400/40 bg-yellow-400/5'
                    : cfg.border
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`shrink-0 p-1.5 rounded-lg ${cfg.bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.iWon && (
                          <span className="text-[10px] font-bold bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full">
                            🏆 ¡Ganaste!
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground truncate mt-0.5">{entry.title}</p>
                      {entry.detail && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.detail}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(entry.drawnAt)}</span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
                    {entry.winnerAvatar ? (
                      <img src={entry.winnerAvatar} alt={entry.winnerName} className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {entry.winnerName[0]?.toUpperCase()}
                        </span>
                      </div>
                    )}
                    {entry.winnerLink ? (
                      <Link href={entry.winnerLink}
                        target={entry.source === 'youtube' ? '_blank' : undefined}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                        {entry.winnerName}
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold text-foreground">{entry.winnerName}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {entry.myTickets != null && entry.myTickets > 0 && (
                      <span className="flex items-center gap-1">
                        <Ticket className="w-3.5 h-3.5" />
                        {entry.myTickets} ticket{entry.myTickets !== 1 ? 's' : ''}
                      </span>
                    )}
                    {entry.participants != null && entry.participants > 0 && (
                      <span>{entry.participants} participantes</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
