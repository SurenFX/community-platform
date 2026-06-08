'use client'

import { useState } from 'react'
import { Share2, Check, Download } from 'lucide-react'

interface Props {
  username: string
}

export default function ShareCardButton({ username }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'loading'>('idle')

  const cardUrl = `/api/profile-card/${encodeURIComponent(username)}`

  async function handleShare() {
    setState('loading')
    try {
      // Try native share first
      if (typeof navigator !== 'undefined' && navigator.share) {
        const profileUrl = `${window.location.origin}/dashboard/profile/${encodeURIComponent(username)}`
        await navigator.share({
          title:  `${username} en SalchiNeta`,
          text:   `Mira mi perfil en SalchiNeta`,
          url:    profileUrl,
        })
        setState('idle')
        return
      }
      // Fallback: copy image URL to clipboard
      await navigator.clipboard.writeText(`${window.location.origin}${cardUrl}`)
      setState('copied')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('idle')
    }
  }

  async function handleDownload() {
    setState('loading')
    try {
      const res  = await fetch(cardUrl)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${username}-salchineta.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setState('idle')
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleShare}
        disabled={state === 'loading'}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-all disabled:opacity-50"
      >
        {state === 'copied'
          ? <Check className="w-3.5 h-3.5" />
          : <Share2 className="w-3.5 h-3.5" />
        }
        {state === 'copied' ? 'Copiado!' : 'Compartir'}
      </button>
      <button
        onClick={handleDownload}
        disabled={state === 'loading'}
        title="Descargar tarjeta PNG"
        className="flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-all disabled:opacity-50"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
