'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Link, Unlink, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { Profile, UserSocialLink } from '@/types/database'
import { disconnectSocialLink, toggleSocialLinkPublic } from '@/app/actions/social'

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
  description: string
  comingSoon?: boolean
  xpItems:     string[]
  connectFn:   'supabase' | 'direct'
  directUrl?:  () => string
  scopes?:     string
  redirectPath?: string
}

const TWITCH_CLIENT_ID = process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID ?? ''

const PLATFORMS: Platform[] = [
  {
    id: 'discord', name: 'Discord', provider: 'discord', dbPlatform: 'DISCORD',
    color: 'text-[#5865F2]', bgColor: 'bg-[#5865F2]/10', borderColor: 'border-[#5865F2]/30',
    description: 'Cuenta principal — siempre conectada',
    xpItems: ['Mensaje: +5 XP', 'Reacción recibida: +3 XP', 'Ayudar: +25 XP'],
    connectFn: 'supabase',
    scopes: 'identify email guilds',
    redirectPath: '/dashboard/configuracion',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
      </svg>
    ),
  },
  {
    id: 'twitch', name: 'Twitch', provider: 'twitch', dbPlatform: 'TWITCH',
    color: 'text-[#9146FF]', bgColor: 'bg-[#9146FF]/10', borderColor: 'border-[#9146FF]/30',
    description: 'Ganá XP por chatear, raids y subs durante el stream',
    xpItems: ['Chat en stream: +8 XP', 'Bloque 10 min: +10 XP', 'Raid: +50 XP', 'Sub: +500 XP', 'Follow: +100 XP'],
    connectFn: 'direct',
    directUrl: () => {
      const params = new URLSearchParams({
        client_id:     TWITCH_CLIENT_ID,
        redirect_uri:  `${window.location.origin}/auth/twitch`,
        response_type: 'code',
        scope:         'user:read:email user:read:follows',
      })
      return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`
    },
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
      </svg>
    ),
  },
  {
    id: 'youtube', name: 'YouTube', provider: 'google', dbPlatform: 'YOUTUBE',
    color: 'text-[#FF0000]', bgColor: 'bg-[#FF0000]/10', borderColor: 'border-[#FF0000]/30',
    description: 'Ganá XP por suscribirte y comentar en videos del canal',
    xpItems: ['Suscribirse: +200 XP', 'Comentar video: +15 XP'],
    connectFn: 'supabase',
    scopes: 'https://www.googleapis.com/auth/youtube.readonly',
    redirectPath: '/auth/youtube',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  {
    id: 'telegram', name: 'Telegram', provider: 'telegram', dbPlatform: 'TELEGRAM',
    color: 'text-[#26A5E4]', bgColor: 'bg-[#26A5E4]/10', borderColor: 'border-[#26A5E4]/30',
    description: 'Ganá XP por participar en el grupo de Telegram',
    xpItems: ['Mensaje en el grupo: +8 XP'],
    connectFn: 'direct',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
  },
  {
    id: 'kick', name: 'Kick', provider: 'kick', dbPlatform: 'KICK',
    color: 'text-[#53FC18]', bgColor: 'bg-[#53FC18]/10', borderColor: 'border-[#53FC18]/30',
    description: 'Ganá XP por chatear, seguir y suscribirte en el stream de Kick',
    xpItems: ['Chat en stream: +8 XP', 'Follow: +100 XP', 'Sub: +500 XP'],
    connectFn: 'direct',
    directUrl: () => '/auth/kick/start',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2 2h6v6h2V6h2V4h2V2h6v6h-2v2h-2v2h-2v4h2v2h2v2h-2v-2h-2v-2h-2v-2H8v2H6v2H4v2H2v-6h2v-2h2v-2h2V8H6V6H4V4H2V2z"/>
      </svg>
    ),
  },
]

export default function ConnectedAccounts({
  userId, profile, socialLinks, identities, successMessage, errorMessage,
}: ConnectedAccountsProps) {
  const [localLinks,      setLocalLinks]      = useState<UserSocialLink[]>(socialLinks)
  const [loading,         setLoading]         = useState<string | null>(null)
  const [localError,      setLocalError]      = useState<string | null>(null)
  const [telegramWaiting, setTelegramWaiting] = useState(false)
  const telegramPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (telegramPollRef.current) clearInterval(telegramPollRef.current)
    }
  }, [])
  const [togglingPublic,  setTogglingPublic]  = useState<string | null>(null)
  const supabase = createClient()

  async function handleTogglePublic(platform: string, current: boolean) {
    setTogglingPublic(platform)
    const result = await toggleSocialLinkPublic(platform, !current)
    if (!result.error) {
      setLocalLinks(prev => prev.map(l =>
        l.platform === platform ? { ...l, is_public: !current } : l
      ))
    }
    setTogglingPublic(null)
  }

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

      if (platform.id === 'telegram') {
        // 1. Generar token en Supabase
        const token = crypto.randomUUID()
        const { error: tokenError } = await supabase
          .from('telegram_link_tokens')
          .insert({ token, user_id: userId })

        if (tokenError) throw tokenError

        // 2. Abrir deep link del bot
        const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
        window.open(`https://t.me/${botUsername}?start=${token}`, '_blank')

        // 3. Esperar vinculación (polling cada 2s por 3 minutos)
        setTelegramWaiting(true)
        setLoading(null)

        const startTime = Date.now()
        telegramPollRef.current = setInterval(async () => {
          if (Date.now() - startTime > 3 * 60 * 1000) {
            clearInterval(telegramPollRef.current!)
            telegramPollRef.current = null
            setTelegramWaiting(false)
            setLocalError('Tiempo agotado. Intentá de nuevo.')
            return
          }

          const { data: link } = await supabase
            .from('user_social_links')
            .select('*')
            .eq('user_id', userId)
            .eq('platform', 'TELEGRAM')
            .maybeSingle()

          if (link) {
            clearInterval(telegramPollRef.current!)
            telegramPollRef.current = null
            setTelegramWaiting(false)
            setLocalLinks(prev => [
              ...prev.filter(l => l.platform !== 'TELEGRAM'),
              link as UserSocialLink,
            ])
          }
        }, 2000)

        return
      }

      if (platform.connectFn === 'direct' && platform.directUrl) {
        window.location.href = platform.directUrl()
        return
      }

      // Supabase OAuth
      const { error } = await supabase.auth.signInWithOAuth({
        provider: platform.provider as any,
        options: {
          scopes:     platform.scopes,
          redirectTo: `${window.location.origin}${platform.redirectPath}`,
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
      const result = await disconnectSocialLink(platform.dbPlatform!)
      if (result.error) {
        setLocalError(result.error)
      } else {
        setLocalLinks(prev => prev.filter(l => l.platform !== platform.dbPlatform))
      }
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
                    <div className="flex items-center gap-2">
                      {platform.id !== 'discord' && (
                        <button
                          onClick={() => handleTogglePublic(platform.dbPlatform!, localLinks.find(l => l.platform === platform.dbPlatform)?.is_public ?? false)}
                          disabled={togglingPublic === platform.dbPlatform}
                          title={localLinks.find(l => l.platform === platform.dbPlatform)?.is_public ? 'Visible en perfil' : 'Oculto en perfil'}
                          className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                            localLinks.find(l => l.platform === platform.dbPlatform)?.is_public
                              ? 'bg-green-400/10 border-green-400/30 text-green-400'
                              : 'bg-secondary border-border text-muted-foreground'
                          }`}
                        >
                          {togglingPublic === platform.dbPlatform
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : localLinks.find(l => l.platform === platform.dbPlatform)?.is_public
                              ? '👁 Visible'
                              : '🙈 Oculto'
                          }
                        </button>
                      )}
                      <button
                        onClick={() => handleDisconnect(platform)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive bg-secondary hover:bg-destructive/10 border border-border hover:border-destructive/30 px-3 py-1.5 rounded-lg transition-all"
                      >
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
                        Desconectar
                      </button>
                    </div>
                  ) : platform.id === 'telegram' && telegramWaiting ? (
                    <span className="flex items-center gap-1.5 text-xs text-[#26A5E4] bg-[#26A5E4]/10 border border-[#26A5E4]/30 px-3 py-1.5 rounded-lg">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Esperando...
                    </span>
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

      {/* Modal espera vinculación Telegram */}
      {telegramWaiting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-card border border-[#26A5E4]/30 rounded-2xl w-full max-w-sm p-6 space-y-5 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#26A5E4]/10 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-[#26A5E4]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground mb-1">Vinculando Telegram</h3>
              <p className="text-sm text-muted-foreground">
                Se abrió Telegram. Tocá <strong className="text-foreground">Iniciar</strong> en el bot para completar la vinculación.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-[#26A5E4] text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Esperando confirmación...
            </div>
            <button
              onClick={() => setTelegramWaiting(false)}
              className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
