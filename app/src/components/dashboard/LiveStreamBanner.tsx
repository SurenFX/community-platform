'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tv, ExternalLink, Users } from 'lucide-react'

interface LiveStreamBannerProps {
  initialIsLive:   boolean
  initialTitle:    string
  initialGame:     string
  twitchChannel:   string
}

export default function LiveStreamBanner({
  initialIsLive,
  initialTitle,
  initialGame,
  twitchChannel,
}: LiveStreamBannerProps) {
  const [isLive, setIsLive] = useState(initialIsLive)
  const [title,  setTitle]  = useState(initialTitle)
  const [game,   setGame]   = useState(initialGame)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('stream-status')
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'platform_config',
      }, (payload: any) => {
        const { key, value } = payload.new ?? {}
        if (key === 'stream_is_live') setIsLive(value === 'true')
        if (key === 'stream_title')   setTitle(value ?? '')
        if (key === 'stream_game')    setGame(value ?? '')
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (!isLive) return null

  return (
    <a
      href={`https://twitch.tv/${twitchChannel}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 bg-[#9146FF]/10 border border-[#9146FF]/30 rounded-xl px-5 py-4 hover:bg-[#9146FF]/15 transition-all group"
    >
      {/* Indicador en vivo */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">En vivo</span>
      </div>

      {/* Info del stream */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{title || 'Stream en vivo'}</p>
        {game && <p className="text-xs text-muted-foreground truncate">{game}</p>}
      </div>

      {/* Twitch icon + link */}
      <div className="flex items-center gap-2 shrink-0 text-[#9146FF]">
        <Tv className="w-4 h-4" />
        <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </a>
  )
}
