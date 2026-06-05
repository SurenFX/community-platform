import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Tv, Clock, Gamepad2, Calendar } from 'lucide-react'

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return 'En curso'
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  const h  = Math.floor(ms / 3600000)
  const m  = Math.floor((ms % 3600000) / 60000)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-AR', {
    day:     'numeric',
    month:   'long',
    year:    'numeric',
    hour:    '2-digit',
    minute:  '2-digit',
  })
}

export default async function StreamsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sessions } = await supabase
    .from('stream_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50)

  const totalStreams  = sessions?.length ?? 0
  const totalMinutes = (sessions ?? []).reduce((acc, s: any) => {
    if (!s.ended_at) return acc
    return acc + Math.floor((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)
  }, 0)
  const totalHours = Math.floor(totalMinutes / 60)

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Historial de streams</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {totalStreams} streams · {totalHours}h transmitidas en total
        </p>
      </div>

      {(!sessions || sessions.length === 0) ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Tv className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-foreground font-semibold mb-1">Sin streams registrados</p>
          <p className="text-sm text-muted-foreground">Los próximos streams aparecerán acá automáticamente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session: any) => {
            const duration = formatDuration(session.started_at, session.ended_at)
            const isLive   = !session.ended_at

            return (
              <div key={session.id}
                className={`bg-card border rounded-xl p-5 ${isLive ? 'border-red-500/30 bg-red-500/5' : 'border-border'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isLive && (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                          EN VIVO
                        </span>
                      )}
                      {session.game && (
                        <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Gamepad2 className="w-3 h-3" />
                          {session.game}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">
                      {session.title || 'Stream sin título'}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(session.started_at)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 text-sm font-bold text-foreground">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      {duration}
                    </div>
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
