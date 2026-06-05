import Link from 'next/link'
import { getLevelColor, getLevelTitle, formatNumber } from '@/lib/utils'
import { Flame, Star } from 'lucide-react'

interface HonorMember {
  user_id:        string
  weekly_xp:      number
  level:          number
  current_streak: number
  profiles:       { username: string; avatar_url: string | null }
}

interface HonorTableProps {
  members:       HonorMember[]
  currentUserId: string
}

const MEDALS = ['🥇', '🥈', '🥉']
const MEDAL_BG = [
  'border-yellow-400/30 bg-yellow-400/5',
  'border-slate-400/20 bg-slate-400/5',
  'border-amber-700/20 bg-amber-700/5',
]

export default function HonorTable({ members, currentUserId }: HonorTableProps) {
  if (!members.length) return null

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
        <h2 className="text-base font-bold text-foreground">Tabla de honor</h2>
        <span className="text-xs text-muted-foreground ml-1">· Más activos esta semana</span>
      </div>

      {/* Podio */}
      <div className="divide-y divide-border">
        {members.map((member, i) => {
          const isMe = member.user_id === currentUserId
          return (
            <Link
              key={member.user_id}
              href={`/dashboard/profile/${member.profiles.username}`}
              className={`flex items-center gap-4 px-6 py-4 transition-all hover:bg-secondary/30 ${isMe ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
            >
              {/* Medal */}
              <span className="text-2xl w-8 text-center shrink-0">{MEDALS[i]}</span>

              {/* Avatar */}
              {member.profiles.avatar_url ? (
                <img
                  src={member.profiles.avatar_url}
                  alt={member.profiles.username}
                  className={`w-11 h-11 rounded-xl shrink-0 ring-2 ${MEDAL_BG[i].includes('yellow') ? 'ring-yellow-400/40' : 'ring-border'}`}
                />
              ) : (
                <div className={`w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 ring-2 ring-border`}>
                  <span className="text-sm font-bold text-primary">
                    {member.profiles.username?.[0]?.toUpperCase()}
                  </span>
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-foreground truncate">
                    {member.profiles.username}
                  </p>
                  {isMe && (
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">Tú</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs font-medium ${getLevelColor(member.level)}`}>
                    Nv. {member.level} · {getLevelTitle(member.level)}
                  </span>
                  {member.current_streak >= 3 && (
                    <span className="flex items-center gap-0.5 text-xs text-orange-400 font-semibold">
                      <Flame className="w-3 h-3" />{member.current_streak}d
                    </span>
                  )}
                </div>
              </div>

              {/* XP semanal */}
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-primary">{formatNumber(member.weekly_xp)}</p>
                <p className="text-xs text-muted-foreground">XP esta semana</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
