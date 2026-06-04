'use client'

import { useState, useTransition } from 'react'
import { Save, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import { updateXpConfig } from '@/app/actions/admin'
import type { XpConfig } from '@/types/database'

const EVENT_LABELS: Record<string, string> = {
  DISCORD_MESSAGE:            'Mensaje Discord',
  DISCORD_REACTION_RECEIVED:  'Reacción recibida',
  DISCORD_HELPED_USER:        'Ayudar usuario',
  TWITCH_WATCH_TIME:          'Watch time Twitch (10 min)',
  TWITCH_RAID_PARTICIPATE:    'Raid Twitch',
  TWITCH_CHAT_MESSAGE:        'Chat Twitch durante stream',
  TWITCH_FOLLOW:              'Follow Twitch',
  TWITCH_SUBSCRIBE:           'Sub Twitch',
  TWITCH_GIFT_SUB:            'Gift sub Twitch',
  YOUTUBE_COMMENT:            'Comentario YouTube',
  YOUTUBE_SHARE:              'Compartir YouTube',
  YOUTUBE_SUBSCRIBE:          'Suscribirse YouTube',
  TELEGRAM_MESSAGE:           'Mensaje en Telegram',
  MISSION_COMPLETED:          'Misión completada',
  STREAK_BONUS:               'Bonus de racha',
  BADGE_EARNED:               'Badge ganado',
  ADMIN_MANUAL_GRANT:         'Otorgado por admin',
}

const PLATFORM_COLOR: Record<string, string> = {
  DISCORD:  'text-indigo-400',
  TWITCH:   'text-purple-400',
  YOUTUBE:  'text-red-400',
  TELEGRAM: 'text-[#26A5E4]',
  MISSION:  'text-amber-400',
  STREAK:   'text-orange-400',
  BADGE:    'text-yellow-400',
  ADMIN:    'text-gray-400',
}

function getPlatformColor(eventType: string): string {
  for (const [key, color] of Object.entries(PLATFORM_COLOR)) {
    if (eventType.startsWith(key)) return color
  }
  return 'text-muted-foreground'
}

export default function XpConfigAdmin({ configs: initialConfigs }: { configs: XpConfig[] }) {
  const [configs, setConfigs] = useState(initialConfigs)
  const [saved,   setSaved]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  function updateConfig(id: string, field: keyof XpConfig, value: any) {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  async function saveConfig(config: XpConfig) {
    startTransition(async () => {
      await updateXpConfig(config.id, {
          base_xp:      config.base_xp,
          cooldown_sec: config.cooldown_sec,
          daily_cap:    config.daily_cap,
          is_enabled:   config.is_enabled,
        })

      setSaved(config.id)
      setTimeout(() => setSaved(null), 2000)
    })
  }

  const inputClass = "w-20 bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/50"

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border grid grid-cols-5 gap-4">
        <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase">Evento</div>
        <div className="text-xs font-semibold text-muted-foreground uppercase text-center">XP Base</div>
        <div className="text-xs font-semibold text-muted-foreground uppercase text-center">Cooldown (s)</div>
        <div className="text-xs font-semibold text-muted-foreground uppercase text-center">Daily Cap (XP)</div>
      </div>

      <div className="divide-y divide-border">
        {configs.map(config => (
          <div key={config.id} className="px-5 py-3 grid grid-cols-5 gap-4 items-center">
            <div className="col-span-2 flex items-center gap-2">
              <button onClick={() => { updateConfig(config.id, 'is_enabled', !config.is_enabled); saveConfig({ ...config, is_enabled: !config.is_enabled }) }}>
                {config.is_enabled
                  ? <ToggleRight className="w-5 h-5 text-primary" />
                  : <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                }
              </button>
              <span className={`text-sm font-medium ${getPlatformColor(config.event_type)} ${!config.is_enabled ? 'opacity-40' : ''}`}>
                {EVENT_LABELS[config.event_type] ?? config.event_type}
              </span>
            </div>

            <div className="flex justify-center">
              <input type="number" min={0} value={config.base_xp}
                onChange={e => updateConfig(config.id, 'base_xp', parseInt(e.target.value) || 0)}
                className={inputClass} disabled={!config.is_enabled} />
            </div>
            <div className="flex justify-center">
              <input type="number" min={0} value={config.cooldown_sec}
                onChange={e => updateConfig(config.id, 'cooldown_sec', parseInt(e.target.value) || 0)}
                className={inputClass} disabled={!config.is_enabled} />
            </div>
            <div className="flex items-center gap-2 justify-center">
              <input type="number" min={0} value={config.daily_cap}
                onChange={e => updateConfig(config.id, 'daily_cap', parseInt(e.target.value) || 0)}
                className={inputClass} disabled={!config.is_enabled} />
              <button onClick={() => saveConfig(config)} disabled={isPending}
                className={`p-1.5 rounded-lg transition-all ${saved === config.id ? 'text-green-400 bg-green-400/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}`}>
                {isPending && saved !== config.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
