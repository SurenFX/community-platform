'use client'

import { useState, useTransition } from 'react'
import { Search, Award, UserPlus, X, Loader2, Check } from 'lucide-react'
import { grantBadge, revokeBadge } from '@/app/actions/admin'

const TIER_COLORS: Record<string, string> = {
  BRONZE:    'bg-amber-700/20 text-amber-600 border-amber-700/30',
  SILVER:    'bg-slate-400/20 text-slate-400 border-slate-400/30',
  GOLD:      'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
  LEGENDARY: 'bg-purple-400/20 text-purple-400 border-purple-400/30',
}

const FAMILY_LABELS: Record<string, string> = {
  discord:   '💬 Discord',
  stream:    '🟣 Stream',
  kick:      '🟢 Kick',
  streak:    '🔥 Racha',
  level:     '⭐ Nivel',
  missions:  '🎯 Misiones',
  youtube:   '📹 YouTube',
  telegram:  '✈️ Telegram',
  seniority: '🏛️ Antigüedad',
  special:   '🏅 Especiales',
}

interface Badge {
  id: string; slug: string; name: string; description: string
  image_url: string; tier: string; family: string
  earned_count: number; earned_user_ids: string[]
}
interface User { id: string; username: string; avatar_url: string | null }

export default function BadgesClient({ badges, users }: { badges: Badge[]; users: User[] }) {
  const [search, setSearch]         = useState('')
  const [grantTarget, setGrantTarget] = useState<Badge | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [actionKey, setActionKey]   = useState<string | null>(null)
  const [localEarned, setLocalEarned] = useState<Record<string, Set<string>>>(
    () => Object.fromEntries(badges.map(b => [b.id, new Set(b.earned_user_ids)]))
  )

  const byFamily: Record<string, Badge[]> = {}
  for (const b of badges) {
    const fam = b.family ?? 'other'
    if (!byFamily[fam]) byFamily[fam] = []
    byFamily[fam].push(b)
  }

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(userSearch.toLowerCase())
  )

  function handleGrant(badge: Badge, targetUser: User) {
    const key = `${badge.id}-${targetUser.id}`
    setActionKey(key)
    startTransition(async () => {
      const result = await grantBadge(badge.id, targetUser.id)
      if (!result.error) {
        setLocalEarned(prev => {
          const next = { ...prev }
          next[badge.id] = new Set([...(prev[badge.id] ?? []), targetUser.id])
          return next
        })
      }
      setActionKey(null)
    })
  }

  function handleRevoke(badge: Badge, userId: string) {
    const key = `revoke-${badge.id}-${userId}`
    setActionKey(key)
    startTransition(async () => {
      const result = await revokeBadge(badge.id, userId)
      if (!result.error) {
        setLocalEarned(prev => {
          const next = { ...prev }
          const set = new Set(prev[badge.id] ?? [])
          set.delete(userId)
          next[badge.id] = set
          return next
        })
      }
      setActionKey(null)
    })
  }

  const q = search.toLowerCase()

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Logros</h1>
            <p className="text-muted-foreground text-sm mt-1">{badges.length} logros en total</p>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar logro..."
            className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {Object.entries(byFamily).map(([family, fBadges]) => {
          const filtered = q ? fBadges.filter(b => b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)) : fBadges
          if (!filtered.length) return null
          return (
            <div key={family} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">{FAMILY_LABELS[family] ?? family}</h2>
              </div>
              <div className="divide-y divide-border">
                {filtered.map((badge) => {
                  const earnedSet = localEarned[badge.id] ?? new Set()
                  return (
                    <div key={badge.id} className="flex items-center gap-4 px-6 py-4">
                      <span className="text-3xl w-10 text-center shrink-0">{badge.image_url || '🏅'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-foreground">{badge.name}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TIER_COLORS[badge.tier] ?? ''}`}>
                            {badge.tier}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{badge.description}</p>
                      </div>
                      <div className="text-right shrink-0 mr-2">
                        <p className="text-lg font-bold text-foreground">{earnedSet.size}</p>
                        <p className="text-xs text-muted-foreground">usuarios</p>
                      </div>
                      <button
                        onClick={() => { setGrantTarget(badge); setUserSearch('') }}
                        className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                        title="Otorgar / revocar logro"
                      >
                        <Award className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {grantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{grantTarget.image_url || '🏅'}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">{grantTarget.name}</p>
                  <p className="text-xs text-muted-foreground">Otorgar o revocar logro</p>
                </div>
              </div>
              <button onClick={() => setGrantTarget(null)} className="p-1.5 rounded-lg hover:bg-secondary transition-all">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Búsqueda de usuario */}
            <div className="px-4 py-3 border-b border-border shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Buscar usuario..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>

            {/* Lista de usuarios */}
            <div className="overflow-y-auto flex-1 divide-y divide-border">
              {filteredUsers.map(u => {
                const has = localEarned[grantTarget.id]?.has(u.id)
                const grantKey  = `${grantTarget.id}-${u.id}`
                const revokeKey = `revoke-${grantTarget.id}-${u.id}`
                const loading   = actionKey === grantKey || actionKey === revokeKey
                return (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.username} className="w-8 h-8 rounded-full shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{u.username[0].toUpperCase()}</span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{u.username}</span>
                    {has && (
                      <span className="text-[10px] text-green-400 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Tiene
                      </span>
                    )}
                    <button
                      disabled={loading}
                      onClick={() => has ? handleRevoke(grantTarget, u.id) : handleGrant(grantTarget, u)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 ${
                        has
                          ? 'bg-red-400/10 text-red-400 hover:bg-red-400/20'
                          : 'bg-primary/10 text-primary hover:bg-primary/20'
                      }`}
                    >
                      {loading
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : has
                          ? <><X className="w-3 h-3" /> Revocar</>
                          : <><UserPlus className="w-3 h-3" /> Otorgar</>
                      }
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
