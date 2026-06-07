import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TerminosPage() {
  const updated = '4 de junio de 2026'

  return (
    <div className="min-h-screen bg-background">

      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🌭</span>
            <span className="font-extrabold text-foreground tracking-tight">SalchiNeta</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16 space-y-10">

        <div>
          <h1 className="text-3xl font-extrabold text-foreground mb-2">Términos de Uso</h1>
          <p className="text-sm text-muted-foreground">Última actualización: {updated}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">1. Aceptación de los términos</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Al registrarte y usar SalchiNeta, aceptás estos Términos de Uso en su totalidad. Si no estás de acuerdo con alguno de estos términos, no debés usar la plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">2. Elegibilidad</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Para usar la plataforma necesitás tener una cuenta activa de Discord y ser miembro de la comunidad. El acceso está limitado a personas invitadas o que cumplan los requisitos de ingreso al servidor.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">3. Conducta del usuario</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">Al usar la plataforma, te comprometés a no:</p>
          <ul className="text-muted-foreground text-sm space-y-2 pl-4 list-disc">
            <li>Usar bots, scripts o cualquier método automatizado para farmear XP o manipular el sistema de puntos.</li>
            <li>Crear múltiples cuentas para obtener ventajas.</li>
            <li>Hacerte pasar por otro usuario o por el equipo de administración.</li>
            <li>Acosar, insultar o intimidar a otros miembros de la comunidad.</li>
            <li>Compartir contenido ilegal, ofensivo o que viole los derechos de terceros.</li>
            <li>Intentar vulnerar la seguridad de la plataforma o acceder a datos que no te corresponden.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">4. Sistema de XP, niveles y recompensas</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            El XP, los niveles, los logros y los tickets son puntos virtuales sin valor monetario. No son canjeables por dinero ni transferibles entre usuarios. La administración se reserva el derecho de ajustar, corregir o anular el XP de cualquier usuario en caso de detectar uso indebido del sistema.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">5. Sorteos</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Los sorteos son organizados y administrados por el equipo de la plataforma. La decisión sobre los ganadores es final e inapelable. La administración se reserva el derecho de cancelar, modificar o repetir un sorteo si detecta irregularidades. Los premios no tienen valor en efectivo salvo que se indique expresamente.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">6. Moderación y sanciones</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            La administración se reserva el derecho de suspender o eliminar permanentemente cualquier cuenta que viole estos términos, sin previo aviso y sin obligación de dar explicaciones. Las sanciones pueden incluir pérdida de XP, bloqueo de participación en sorteos o expulsión definitiva de la plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">7. Disponibilidad del servicio</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            La plataforma se ofrece tal cual está, sin garantías de disponibilidad continua. La administración puede modificar, pausar o discontinuar cualquier función o la plataforma completa en cualquier momento, sin previo aviso ni responsabilidad.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">8. Cuentas de terceros</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Al vincular cuentas de Discord, Twitch, YouTube o Telegram, autorizás a la plataforma a leer tu actividad pública en esas redes con el único fin de calcular XP. Podés desvincular cualquier cuenta en cualquier momento desde la configuración. El uso de cada plataforma vinculada está sujeto también a sus propios términos de servicio.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">9. Limitación de responsabilidad</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            La plataforma no se hace responsable por pérdida de datos, interrupciones del servicio, cambios en las APIs de terceros que afecten el funcionamiento, ni por cualquier daño directo o indirecto derivado del uso de la plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">10. Cambios a los términos</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Podemos actualizar estos términos en cualquier momento. Los cambios significativos serán comunicados con al menos 7 días de anticipación. El uso continuado de la plataforma implica la aceptación de los nuevos términos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">11. Contacto</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Para cualquier consulta sobre estos términos, podés contactarnos a través del servidor de Discord de la comunidad.
          </p>
        </section>

        <div className="pt-6 border-t border-border">
          <Link href="/" className="text-sm text-primary hover:underline">← Volver al inicio</Link>
        </div>

      </main>

      <footer className="border-t border-border/50 py-8 px-6 text-center">
        <p className="text-xs text-muted-foreground">🌭 SalchiNeta · Términos de Uso</p>
      </footer>

    </div>
  )
}
