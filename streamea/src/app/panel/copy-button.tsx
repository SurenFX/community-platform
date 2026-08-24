'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* si el navegador lo bloquea, el usuario puede copiar a mano */
    }
  }

  return (
    <button
      onClick={copy}
      type="button"
      className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-sm text-zinc-300 transition hover:border-brand hover:text-white"
    >
      {copied ? <Check className="h-4 w-4 text-brand-kick" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}
