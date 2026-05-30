'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Link, Unlink, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { Profile, UserSocialLink } from '@/types/database'

interface Identity {
  id:             string
  provider:       string
  identity_data?: Record<string, unknown>
}

interface ConnectedAccountsProps {
  userId:         string
  profile:        Profile | null
  socialLinks:    UserSocialLink[]
  identities:     Identity[]
  successMessage: string | null
  errorMessage:   string | null
}

interface Platform {
  id:          string
  name:        string
  provider:    string
  dbPlatform?: string
  color:       string
  bgColor:     string
  borderColor: string
  icon:        React.ReactNode
  scopes:      string
  redirectPath: string  // path al que redirige después del OAuth
  description: string
  comingSoon?: boolean
  xpItems:     string[]
}

const PLATFORMS: Platform[] = [
  {
    id: 'discord', name: 'Discord', provider: 'discord', dbPlatform: 'DISCORD',
    color: 'text-[#5865F2]', bgColor: 'bg-[#5865F2]/10', borderColor: 'border-[#5865F2]/30',
    scopes: 'identify email guilds', redirectPath: '/dashboard/settings',
    description: 'Cuenta principal — siempre conectada',
    xpItems: ['Mensaje: +5 XP', 'Reacción recibida: +3 XP', 'Ayudar: +25 XP'],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
      </svg>
    ),
  },
  {
    id: 'twitch', name: 'Twitch', provider: 'twitch', dbPlatform: 'TWITCH',
    color: 'text-[#9146FF]', bgColor: 'bg-[#9146FF]/10', borderColor: 'border-[#9146FF]/30',
    scopes: 'user:read:email user:read:follows',
    redirectPath: '/auth/twitch',
    description: 'Ganá XP por chatear, raids y subs durante el stream',
    xpItems: ['Chat en stream: +8 XP', 'Bloque 10 min: +10 XP', 'Raid: +50 XP', 'Sub: +500 XP', 'Follow: +100 XP'],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
      </svg>
    ),
  },
  {
    id: 'youtube', name: 'YouTube', provider: 'google', dbPlatform: 'YOUTUBE',
    color: 'text-[#FF0000]', bgColor: 'bg-[#FF0000]/10', borderColor: 'border-[#FF0000]/30',
    scopes: 'https://www.googleapis.com/auth/youtube.readonly',
    redirectPath: '/auth/youtube',
    description: 'Ganá XP por suscribirte y comentar en videos del canal',
    xpItems: ['Suscribirse: +200 XP', 'Comentar video: +15 XP'],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  {
    id: 'twitter', name: 'Twitter / X', provider: 'twitter', dbPlatform: 'TWITTER',
    color: 'text-foreground', bgColor: 'bg-foreground/10', borderColor: 'border-foreground/20',
    scopes: 'tweet.read users.read', redirectPath: '/dashboard/settings',
    description: 'Ganá XP por compartir contenido',
    comingSoon: true,
    xpItems: ['Compartir contenido: +20 XP'],
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
]

export default function ConnectedAccounts({
  userId, profile, socialLinks, identities, successMessage, errorMessage,
}: ConnectedAccountsProps) {
  const [localLinks, setLocalLinks] = useState<UserSocialLink[]>(socialLinks)
  const [loading,    setLoading]    = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const supabase = createClient()

  function isConnected(platform: Platform): boolean {
    if (platform.id === 'discord') return true
    return localLinks.some(l => l.platform === platform.dbPlatform)
  }

  function getUsername(platform: Platform): string | null {
    if (platform.id === 'discord') return profile?.discord_tag ?? null
    const link = localLinks.find(l => l.platform === platform.dbPlatform)
    return link?.username ?? null
  }

  async function handleConnect(platform: Platform) {
    if (platform.comingSoon || platform.id === 'discord') return
    try {
      setLoading(platform.id)
      setLocalError(null)

      const redirectTo = `${window.location.origin}${platform.redirectPath}`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: platform.provider as any,
        options: {
          scopes:     platform.scopes,
          redirectTo,
          queryParams: platform.id === 'youtube' ? {
            access_type: 'offline',
            prompt:      'consent',
          } : undefined,
        },
      })
      if (error) throw error
    } catch (err: any) {
      setLocalError(err.message ?? 'Error al conectar la cuenta')
      setLoading(null)
    }
  }

  async function handleDisconnect(platform: Platform) {
    if (platform.id === 'discord') return
    try {
      setLoading(platform.id)
      setLocalError(null)

      const { error } = await supabase
        .from('user_social_links')
        .delete()
        .eq('user_id', userId)
        .eq('platform', platform.dbPlatform!)

      if (error) throw error

      setLocalLinks(prev => prev.filter(l => l.platform !== platform.dbPlatform))
      setLoading(null)
    } catch (err: any) {
      setLocalError(err.message ?? 'Error al desconectar')
      setLoading(null)
    }
  }

  const displayError = localError ?? errorMessage

  return (
    <div className="space-y-4">

      {successMessage && (
        <div className="flex items-center gap-2 bg-green-400/10 border border-green-400/20 text-green-400 rounded-xl px-4 py-3 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMessage} Empezás a ganar XP automáticamente.
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-base font-semibold text-foreground mb-1">Cuentas conectadas</h2>
          <p className="text-sm text-muted-foreground">
            Conectá tus redes sociales para ganar XP en todas las plataformas.
          </p>
        </div>

        {displayError && (
          <div className="flex items-center gap-2 bg-destructive/10 border-b border-destructive/20 text-destructive px-6 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {displayError}
          </div>
        )}

        <div className="divide-y divide-border">
          {PLATFORMS.map((platform) => {
            const connected = isConnected(platform)
            const username  = getUsername(platform)
            const isLoading = loading === platform.id

            return (
              <div key={platform.id} className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${connected ? `${platform.bgColor} ${platform.borderColor}` : 'bg-secondary border-border'}`}>
                    <span className={connected ? platform.color : 'text-muted-foreground'}>
                      {platform.icon}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground">{platform.name}</p>
                      {platform.comingSoon && (
                        <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded font-medium">Próximamente</span>
                      )}
                      {connected && !platform.comingSoon && (
                        <span className="text-[10px] bg-green-400/15 text-green-400 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> Conectado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {connected && username ? `@${username}` : platform.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 ml-4">
                  {platform.comingSoon ? (
                    <span className="text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-lg opacity-50">Pronto</span>
                  ) : platform.id === 'discord' ? (
                    <span className="text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-lg">Principal</span>
                  ) : connected ? (
                    <button
                      onClick={() => handleDisconnect(platform)}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive bg-secondary hover:bg-destructive/10 border border-border hover:border-destructive/30 px-3 py-1.5 rounded-lg transition-all"
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
                      Desconectar
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(platform)}
                      disabled={isLoading}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all border ${platform.color} ${platform.bgColor} ${platform.borderColor} hover:opacity-80 disabled:opacity-50`}
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link className="w-3 h-3" />}
                      Conectar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* XP por plataforma */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">XP por plataforma</h2>
        <div className="space-y-4">
          {PLATFORMS.map(platform => (
            <div key={platform.id} className="flex gap-4">
              <div className={`shrink-0 mt-0.5 ${isConnected(platform) ? platform.color : 'text-muted-foreground'}`}>
                {platform.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1.5">{platform.name}</p>
                <div className="flex flex-wrap gap-2">
                  {platform.xpItems.map(item => (
                    <span key={item} className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded-lg">{item}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
