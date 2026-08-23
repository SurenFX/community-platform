import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sortea — Sorteos en vivo para streamers',
  description:
    'Lanzá sorteos por palabra clave en tu chat de Kick y Twitch en segundos. Sin bots que configurar, sin OBS, sin vueltas.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
