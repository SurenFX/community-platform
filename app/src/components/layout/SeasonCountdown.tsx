'use client'

import { useState, useEffect } from 'react'

interface Props {
  endsAt: string
  name:   string
}

function getTimeLeft(endsAt: string) {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return null
  const totalSecs = Math.floor(ms / 1000)
  const d  = Math.floor(totalSecs / 86400)
  const h  = Math.floor((totalSecs % 86400) / 3600)
  const m  = Math.floor((totalSecs % 3600) / 60)
  const s  = totalSecs % 60
  return { d, h, m, s }
}

export default function SeasonCountdown({ endsAt, name }: Props) {
  const [time, setTime] = useState(() => getTimeLeft(endsAt))

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft(endsAt)), 1000)
    return () => clearInterval(id)
  }, [endsAt])

  return (
    <div
      className="relative overflow-hidden bg-card border border-primary/20 rounded-2xl px-5 py-4 flex items-center gap-4"
      style={{ background: 'radial-gradient(ellipse at 0% 50%, hsl(185 100% 45% / 0.08) 0%, transparent 60%)' }}
    >
      <div className="text-2xl">🏆</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-primary uppercase tracking-widest">Temporada activa</p>
        <p className="text-base font-black text-foreground">{name}</p>
      </div>
      <div className="text-right shrink-0">
        {time ? (
          <>
            <p className="text-xl font-black text-foreground tabular-nums">
              {time.d > 0 && <span>{time.d}<span className="text-xs font-semibold text-muted-foreground">d </span></span>}
              {String(time.h).padStart(2, '0')}
              <span className="text-xs font-semibold text-muted-foreground">h </span>
              {String(time.m).padStart(2, '0')}
              <span className="text-xs font-semibold text-muted-foreground">m </span>
              {String(time.s).padStart(2, '0')}
              <span className="text-xs font-semibold text-muted-foreground">s</span>
            </p>
            <p className="text-xs text-muted-foreground">restantes</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Terminada</p>
        )}
      </div>
    </div>
  )
}
