import { User } from 'lucide-react'

const PLATFORMS = [
  { key: 'DISCORD',  label: 'Discord',  color: 'text-indigo-400',    bg: 'bg-indigo-400/10',  border: 'border-indigo-400/20',  emoji: '💬' },
  { key: 'TWITCH',   label: 'Twitch',   color: 'text-purple-400',    bg: 'bg-purple-400/10',  border: 'border-purple-400/20',  emoji: '📺' },
  { key: 'KICK',     label: 'Kick',     color: 'text-[#53FC18]',     bg: 'bg-[#53FC18]/10',   border: 'border-[#53FC18]/20',   emoji: '🟢' },
  { key: 'YOUTUBE',  label: 'YouTube',  color: 'text-red-400',       bg: 'bg-red-400/10',     border: 'border-red-400/20',     emoji: '▶️' },
  { key: 'TELEGRAM', label: 'Telegram', color: 'text-sky-400',       bg: 'bg-sky-400/10',     border: 'border-sky-400/20',     emoji: '✈️' },
] as const

interface PlatformEntry {
  username:   string
  avatar_url: string | null
  xp:         number
  rank:       number
}

interface Props {
  platformData: Record<string, PlatformEntry[]>
}

export default function PlatformLeaderboards({ platformData }: Props) {
  const hasSomeData = Object.values(platformData).some(arr => arr.length > 0)
  if (!hasSomeData) return null

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-foreground">Top por plataforma</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {PLATFORMS.map(({ key, label, color, bg, border, emoji }) => {
          const entries = platformData[key] ?? []
          if (entries.length === 0) return null
          return (
            <div key={key} className={`bg-card border ${border} rounded-2xl overflow-hidden`}>
              <div className={`px-4 py-3 border-b ${border} ${bg} flex items-center gap-2`}>
                <span className="text-base">{emoji}</span>
                <span className={`text-sm font-bold ${color}`}>{label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-medium">últimos 90 días</span>
              </div>
              <div className="divide-y divide-border">
                {entries.map((entry, i) => (
                  <div key={entry.username} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`text-[11px] font-black w-5 text-center shrink-0 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      {i + 1}
                    </span>
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt={entry.username}
                        className="w-7 h-7 rounded-full shrink-0 object-cover" />
                    ) : (
                      <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center ${bg}`}>
                        <User className={`w-3.5 h-3.5 ${color}`} />
                      </div>
                    )}
                    <span className="flex-1 text-sm font-semibold text-foreground truncate">{entry.username}</span>
                    <span className={`text-xs font-black shrink-0 ${color}`}>{entry.xp.toLocaleString('es-AR')} XP</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
