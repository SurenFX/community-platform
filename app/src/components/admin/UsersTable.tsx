'use client'

import { useState, useTransition } from 'react'
import { Shield, Ban, ShieldOff, User, Search, Loader2, Zap } from 'lucide-react'
import GrantXpModal from './GrantXpModal'
import { getLevelColor, getLevelTitle, formatNumber, timeAgo } from '@/lib/utils'
import { setUserAdmin, setUserBanned } from '@/app/actions/social'

interface UserRow {
  id:               string
  username:         string
  discord_tag:      string
  avatar_url:       string | null
  is_admin:         boolean
  is_banned:        boolean
  created_at:       string
  user_reputation:  { total_xp: number; level: number; current_streak: number } | null
  user_social_links: { platform: string }[]
}

interface UsersTableProps {
  users: UserRow[]
}

const PLATFORM_ICONS: Record<string, string> = {
  DISCORD:  '🎮',
  TWITCH:   '🟣',
  YOUTUBE:  '🔴',
  TELEGRAM: '✈️',
}

export default function UsersTable({ users: initialUsers }: UsersTableProps) {
  const [users,  setUsers]  = useState(initialUsers)
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [actionUserId, setActionUserId] = useState<string | null>(null)
  const [grantTarget, setGrantTarget] = useState<{ id: string; username: string } | null>(null)

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.discord_tag.toLowerCase().includes(search.toLowerCase())
  )

  async function toggleAdmin(userId: string, currentValue: boolean) {
    setActionUserId(userId)
    startTransition(async () => {
      const result = await setUserAdmin(userId, !currentValue)
      if (!result.error) {
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, is_admin: !currentValue } : u
        ))
      }
      setActionUserId(null)
    })
  }

  async function toggleBan(userId: string, currentValue: boolean) {
    setActionUserId(userId)
    startTransition(async () => {
      const result = await setUserBanned(userId, !currentValue)
      if (!result.error) {
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, is_banned: !currentValue } : u
        ))
      }
      setActionUserId(null)
    })
  }

  return (
    <>
    <div className="space-y-4">
      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por username o Discord tag..."
          className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usuario</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">XP / Nivel</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plataformas</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Miembro desde</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(user => {
                const rep   = user.user_reputation
                const level = rep?.level ?? 1
                const isLoading = actionUserId === user.id

                return (
                  <tr key={user.id} className={`hover:bg-secondary/20 transition-colors ${user.is_banned ? 'opacity-50' : ''}`}>
                    {/* Usuario */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.username} className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-foreground">{user.username}</p>
                            {user.is_admin && (
                              <Shield className="w-3.5 h-3.5 text-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{user.discord_tag}</p>
                        </div>
                      </div>
                    </td>

                    {/* XP / Nivel */}
                    <td className="px-5 py-4">
                      <p className={`text-sm font-bold ${getLevelColor(level)}`}>
                        Nv. {level} — {getLevelTitle(level)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatNumber(rep?.total_xp ?? 0)} XP
                      </p>
                    </td>

                    {/* Plataformas */}
                    <td className="px-5 py-4">
                      <div className="flex gap-1">
                        {user.user_social_links.map(link => (
                          <span key={link.platform} title={link.platform} className="text-base">
                            {PLATFORM_ICONS[link.platform] ?? '🔗'}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Fecha */}
                    <td className="px-5 py-4">
                      <p className="text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </td>

                    {/* Estado */}
                    <td className="px-5 py-4">
                      {user.is_banned ? (
                        <span className="text-xs bg-destructive/15 text-destructive px-2 py-0.5 rounded font-medium">Baneado</span>
                      ) : user.is_admin ? (
                        <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded font-medium">Admin</span>
                      ) : (
                        <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded font-medium">Miembro</span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <button
                              onClick={() => toggleAdmin(user.id, user.is_admin)}
                              title={user.is_admin ? 'Quitar admin' : 'Hacer admin'}
                              className={`p-1.5 rounded-lg transition-all ${user.is_admin ? 'text-primary bg-primary/10 hover:bg-primary/20' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}`}
                            >
                              {user.is_admin ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => toggleBan(user.id, user.is_banned)}
                              title={user.is_banned ? 'Desbanear' : 'Banear'}
                              className={`p-1.5 rounded-lg transition-all ${user.is_banned ? 'text-green-400 bg-green-400/10 hover:bg-green-400/20' : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'}`}
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setGrantTarget({ id: user.id, username: user.username })}
                              title="Otorgar XP"
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-yellow-400 hover:bg-yellow-400/10 transition-all"
                            >
                              <Zap className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-muted-foreground text-sm">No se encontraron usuarios</p>
          </div>
        )}
      </div>
    </div>


    {grantTarget && (
      <GrantXpModal
        userId={grantTarget.id}
        username={grantTarget.username}
        onClose={() => setGrantTarget(null)}
        onGranted={(amount) => {
          setUsers(prev => prev.map(u =>
            u.id === grantTarget.id
              ? { ...u, user_reputation: u.user_reputation
                  ? { ...u.user_reputation, total_xp: u.user_reputation.total_xp + amount }
                  : u.user_reputation }
              : u
          ))
        }}
      />
    )}
    </>
  )
}
