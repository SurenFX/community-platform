import type { Metadata } from 'next'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import Link from 'next/link'
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable'
import SeasonCountdown from '@/components/layout/SeasonCountdown'
import { Trophy, Medal, User } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Ranking — SalchiNeta',
  description: 'Los miembros más activos de la comunidad SalchiNeta',
}

export const revalidate = 60

export default async function PublicRankingPage() {
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [{ data: entries }, { data: activeSeason }, { data: closedSeasons }] = await Promise.all([
    supabase
      .from('user_reputation')
      .select('user_id, total_xp, weekly_xp, monthly_xp, level, current_streak, profiles!inner(username, avatar_url, equipped_border_color, equipped_name_emoji, equipped_title_override)')
      .order('total_xp', { ascending: false })
      .limit(50),
    supabase
      .from('seasons')
      .select('id, name, ends_at')
      .eq('status', 'ACTIVE')
      .maybeSingle(),
    supabase
      .from('seasons')
      .select('id, name, starts_at, ends_at')
      .eq('status', 'CLOSED')
      .order('ends_at', { ascending: false })
      .limit(10),
  ])

  // Para cada temporada cerrada, obtener top 3 — todo en paralelo
  const seasonHistories = await Promise.all(
    ((closedSeasons ?? []) as any[]).map(async (season) => {
      const { data: topUsers } = await supabase
        .from('xp_events')
        .select('user_id, xp_awarded')
        .gte('created_at', season.starts_at)
        .lte('created_at', season.ends_at)
        .limit(5000)

      if (!topUsers?.length) return { season, top3: [] }

      const xpMap: Record<string, number> = {}
      for (const e of topUsers as any[]) {
        xpMap[e.user_id] = (xpMap[e.user_id] ?? 0) + e.xp_awarded
      }

      const sorted = Object.entries(xpMap).sort((a, b) => b[1] - a[1]).slice(0, 3)
      const userIds = sorted.map(([id]) => id)

      const { data: profiles } = await supabase
        .from('profiles').select('id, username, avatar_url').in('id', userIds)

      const profileMap: Record<string, any> = {}
      for (const p of profiles ?? []) profileMap[(p as any).id] = p

      return {
        season,
        top3: sorted.map(([userId, xp], i) => ({
          username:   profileMap[userId]?.username ?? '???',
          avatar_url: profileMap[userId]?.avatar_url ?? null,
          xp,
          rank: i + 1,
        })),
      }
    })
  )

  const RANK_ICONS = [
    <Trophy key={1} className="w-4 h-4 text-yellow-400" />,
    <Medal  key={2} c