'use client'

import { useEffect, useState } from 'react'
import { Sword, X } from 'lucide-react'

export default function DailyResetToast() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      const key  = 'sn_last_visit_day'
      const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC
      const last  = localStorage.getItem(key)

      if (last && last !== today) {
        setShow(true)
        setTimeout(() => setShow(false), 6000)
      }
      localStorage.setItem(key, today)
    } catch {}
  }, [])

  if (!show) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9998] fade-in-up">
      <div className="flex items-center gap-3 bg-card border border-primary/40 rounded-2xl px-4 py-3 shadow-[0_0_24px_rgba(0,200,220,0.2)] max-w-xs">
        <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Sword className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Nuevas quests disponibles</p>
          <p className="text-xs text-muted-foreground mt-0.5">Tus quests diarias se reiniciaron.</p>
        </div>
        <button
          onClick={() => setShow(false)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
