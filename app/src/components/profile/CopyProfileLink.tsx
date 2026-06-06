'use client'

import { useState } from 'react'
import { Link, Check } from 'lucide-react'

export default function CopyProfileLink({ username }: { username: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}/dashboard/profile/${username}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar link del perfil"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shrink-0"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-green-400" />
          <span className="text-green-400">¡Copiado!</span>
        </>
      ) : (
        <>
          <Link className="w-3.5 h-3.5" />
          Compartir
        </>
      )}
    </button>
  )
}
