import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Streamea — Herramientas para streamers',
  description:
    'Sorteos por palabra clave en tu chat de Kick y Twitch en segundos. Y pronto: comandos, anuncios y más. Sin bots que configurar, sin vueltas.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
