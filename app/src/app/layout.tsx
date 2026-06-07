import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SalchiNeta — Comunidad',
  description: 'Ganá XP por participar en Discord, Twitch, YouTube y Telegram. Subí de nivel, desbloqueá logros y competí en el ranking.',
  openGraph: {
    title:       'SalchiNeta — Comunidad',
    description: 'Ganá XP por participar en Discord, Twitch, YouTube y Telegram.',
    type:        'website',
    locale:      'es_AR',
  },
  twitter: {
    card:        'summary',
    title:       'SalchiNeta — Comunidad',
    description: 'Ganá XP por participar en Discord, Twitch, YouTube y Telegram.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
