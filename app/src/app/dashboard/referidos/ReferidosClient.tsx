'use client'

import { useTransition } from 'react'
import { ExternalLink, Gamepad2 } from 'lucide-react'
import { trackReferralClick } from '@/app/actions/admin'

interface ReferralLink {
  id:             string
  game_name:      string
  game_image_url: string
  referral_url:   string
  description:    string
  hide_name:      boolean
}

function GameCard({ link }: { link: ReferralLink }) {
  const [, start] = useTransition()

  function handleClick() {
    start(() => trackReferralClick(link.id))
    window.open(link.referral_url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="group relative rounded-2xl overflow-hidden cursor-pointer bg-[#0d0d0f] border border-border"
      style={{ aspectRatio: '3/4' }}
      onClick={handleClick}
    >
      {/* Imagen del juego */}
      {link.game_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={link.game_image_url}
          alt={link.game_name}
          className="absolute inset-0 w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary">
          <Gamepad2 className="w-16 h-16 text-muted-foreground/30" />
        </div>
      )}

      {/* Gradiente inferior — solo si se muestra contenido abajo */}
      {(!link.hide_name || link.description) && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      )}
      {/* Gradiente hover siempre (para el boton) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Border glow ring */}
      <div className="absolute inset-0 rounded-2xl ring-0 group-hover:ring-2 group-hover:ring-primary/70 transition-all duration-300" />

      {/* Contenido inferior */}
      <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
        {!link.hide_name && (
          <p className="text-white font-bold text-lg leading-tight drop-shadow-lg">
            {link.game_name}
          </p>
        )}
        {link.description && (
          <p className="text-white/70 text-xs mt-1 line-clamp-2 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {link.description}
          </p>
        )}

        {/* Boton */}
        <button
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-semibold opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 transition-all duration-300 hover:bg-primary/90 active:scale-95"
          onClick={e => { e.stopPropagation(); handleClick() }}
        >
          <ExternalLink className="w-4 h-4" />
          Jugar con referido
        </button>
      </div>
    </div>
  )
}

export default function ReferidosClient({ links }: { links: ReferralLink[] }) {
  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Gamepad2 className="w-14 h-14 mb-4 opacity-25" />
        <p className="text-base font-medium">No hay juegos cargados todavia</p>
        <p className="text-sm mt-1 opacity-70">Volve pronto, el streamer va a agregar sus juegos favoritos</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {links.map(link => (
        <GameCard key={link.id} link={link} />
      ))}
    </div>
  )
}
