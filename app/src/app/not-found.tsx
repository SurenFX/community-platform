import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-sm">

        <div className="text-7xl mb-6 float">🌭</div>

        <h1 className="text-6xl font-black text-foreground mb-2">404</h1>
        <p className="text-xl font-semibold text-foreground mb-2">Página no encontrada</p>
        <p className="text-muted-foreground text-sm mb-8">
          La página que buscás no existe o fue movida.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, hsl(185 100% 45%), hsl(45 100% 55%))', color: '#0a0f1a' }}
          >
            Ir al dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 transition-all"
          >
            Inicio
          </Link>
        </div>

      </div>
    </div>
  )
}
