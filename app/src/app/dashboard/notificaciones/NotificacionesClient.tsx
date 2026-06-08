'use client'

import { useState, useTransition } from 'react'
import { Bell, CheckCheck, Check, Zap, Trophy, Flame, Star, Swords, CircleDollarSign, Gift, Loader2 } from 'lucide-react'
import { markAllAsRead, markAsRead, loadMoreNotifications } from '@/app/actions/notifications'

interface Notification {
  id:         string
  type:       string
  title:      string
  body?:      string
  message?:   string
  is_read:    boolean
  created_at: string
}

function timeAgo(dateStr: string) {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)   return 'ahora'
  if (mins  < 60)  return `${mins}m`
  if (hours < 24)  return `${hours}h`
  if (days  < 30)  return `${days}d`
  return new Date(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function NotifIcon({ type }: { type: string }) {
  const map: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    LEVEL_UP:          { icon: Trophy,          color: 'text-yellow-400', bg: 'bg-yellow-400/15' },
    BADGE_EARNED:      { icon: Star,            color: 'text-purple-400', bg: 'bg-purple-400/15' },
    MISSION_COMPLETED: { icon: Check,           color: 'text-green-400',  bg: 'bg-green-400/15'  },
    STREAK_BONUS:      { icon: Flame,           color: 'text-orange-400', bg: 'bg-orange-400/15' },
    CHALLENGE_REWARD:  { icon: Swords,          color: 'text-primary',    bg: 'bg-primary/15'    },
    XP_GRANT:          { icon: Zap,             color: 'text-yellow-400', bg: 'bg-yellow-400/15' },
    SYSTEM:            { icon: CircleDollarSign, color: 'text-primary',   bg: 'bg-primary/15'    },
    REWARD:            { icon: Gift,            color: 'text-pink-400',   bg: 'bg-pink-400/15'   },
  }
  const cfg = map[type] ?? { icon: Bell, color: 'text-muted-foreground', bg: 'bg-secondary' }
  const Icon = cfg.icon
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
      <Icon className={`w-4 h-4 ${cfg.color}`} />
    </div>
  )
}

export default function NotificacionesClient({
  initialNotifications,
  totalCount,
}: {
  initialNotifications: Notification[]
  totalCount: number
}) {
  const [notifs,    setNotifs]    = useState(initialNotifications)
  const [isPending, start]        = useTransition()
  const [filter,    setFilter]    = useState<'all' | 'unread'>('all')
  const [hasMore,   setHasMore]   = useState(initialNotifications.length < totalCount)
  const [loading,   setLoading]   = useState(false)

  const unreadCount = notifs.filter(n => !n.is_read).length

  async function handleLoadMore() {
    if (!notifs.length) return
    setLoading(true)
    const cursor = notifs[notifs.length - 1].created_at
    const { data, hasMore: more } = await loadMoreNotifications(cursor)
    setNotifs(prev => [...prev, ...data])
    setHasMore(more)
    setLoading(false)
  }

  function handleMarkAll() {
    start(async () => {
      await markAllAsRead()
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    })
  }

  function handleMarkOne(id: string) {
    start(async () => {
      await markAsRead(id)
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    })
  }

  const visible = filter === 'unread' ? notifs.filter(n => !n.is_read) : notifs

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notificaciones</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 border border-border px-3 py-2 rounded-xl transition-all disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Marcar todo leído
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
              filter === f
                ? 'bg-primary/15 text-primary border border-primary/25'
                : 'bg-secondary text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            {f === 'all' ? 'Todas' : `No leídas${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {visible.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-foreground font-semibold">
              {filter === 'unread' ? 'Sin notificaciones sin leer' : 'Sin notificaciones'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map(n => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                  !n.is_read ? 'bg-primary/5 hover:bg-primary/8' : 'hover:bg-secondary/30'
                }`}
              >
                <NotifIcon type={n.type} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold ${!n.is_read ? 'text-foreground' : 'text-foreground/80'}`}>
                      {n.title}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
                      {!n.is_read && (
                        <button
                          onClick={() => handleMarkOne(n.id)}
                          disabled={isPending}
                          title="Marcar como leído"
                          className="w-5 h-5 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-all disabled:opacity-50"
                        >
                          <span c