import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrivacidadPage() {
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
          <h1 className="text-3xl font-extrabold text-foreground mb-2">Política de Privacidad</h1>
          <p className="text-sm text-muted-foreground">Última actualización: {updated}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">1. Quiénes somos</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            SalchiNeta es una plataforma de comunidad que unifica la actividad de sus miembros en múltiples redes sociales (Discord, Twitch, YouTube y Telegram) con el objetivo de reconocer y recompensar la participación activa.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">2. Qué datos recopilamos</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">Al registrarte y usar la plataforma, recopilamos únicamente:</p>
          <ul className="text-muted-foreground text-sm space-y-2 pl-4 list-disc">
            <li>Tu ID de usuario, nombre de usuario y avatar de Discord (obtenidos mediante OAuth con tu consentimiento).</li>
            <li>Los nombres de usuario de las plataformas que vincules voluntariamente (Twitch, YouTube, Telegram).</li>
            <li>Métricas de actividad pública: cantidad de mensajes, comentarios, reacciones y tiempo de visualización en las plataformas conectadas.</li>
            <li>Tu progreso en la plataforma: XP acumulado, nivel, badges, misiones completadas y rachas.</li>
          </ul>
          <p className="text-muted-foreground text-sm leading-relaxed">
            No recopilamos contraseñas, información de pago, números de teléfono ni ningún dato sensible.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">3. Cómo usamos tus datos</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">Usamos tus datos exclusivamente para:</p>
          <ul className="text-muted-foreground text-sm space-y-2 pl-4 list-disc">
            <li>Calcular y acreditar XP por tu actividad en las plataformas conectadas.</li>
            <li>Mostrar tu perfil, nivel y logros dentro de la plataforma.</li>
            <li>Enviarte notificaciones sobre tu progreso (subida de nivel, misiones completadas, badges desbloqueados).</li>
            <li>Generar el ranking de la comunidad.</li>
          </ul>
          <p className="text-muted-foreground text-sm leading-relaxed">
            No vendemos, compartimos ni cedemos tus datos a terceros bajo ninguna circunstancia.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">4. Visibilidad de tu información</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Tu perfil público muestra tu nombre de usuario, nivel, XP, badges y rachas. Las redes sociales vinculadas están <strong className="text-foreground">ocultas por defecto</strong> — podés elegir cuáles mostrar públicamente desde la configuración de tu cuenta.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">5. Almacenamiento y seguridad</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Tus datos se almacenan de forma segura mediante Supabase, con cifrado en tránsito (HTTPS/TLS) y en reposo. El acceso a la base de datos está protegido mediante políticas de seguridad por fila (Row Level Security).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">6. Tus derechos</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">Tenés derecho a:</p>
          <ul className="text-muted-foreground text-sm space-y-2 pl-4 list-disc">
            <li><strong className="text-foreground">Acceder</strong> a tus datos en cualquier momento desde tu perfil.</li>
            <li><strong className="text-foreground">Desconectar</strong> cualquier red social vinculada desde la configuración.</li>
            <li><strong className="text-foreground">Eliminar tu cuenta</strong> y todos tus datos asociados contactándonos.</li>
            <li><strong className="text-foreground">Controlar</strong> qué información es visible públicamente en tu perfil.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">7. Plataformas de terceros</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            La vinculación con Discord, Twitch, YouTube y Telegram se realiza mediante sus APIs y sistemas OAuth oficiales. Al vincular una cuenta, aceptás también los términos de servicio de cada plataforma. No controlamos ni somos responsables por las políticas de privacidad de esas plataformas.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">8. Cambios a esta política</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Si realizamos cambios significativos a esta política, lo comunicaremos a través de la plataforma con al menos 7 días de anticipación. El uso continuado de la plataforma implica la aceptación de los cambios.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">9. Contacto</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Si tenés preguntas sobre esta política o querés ejercer tus derechos, podés contactarnos a través del servidor de Discord de la comunidad.
          </p>
        </section>

        <div className="pt-6 border-t border-border">
          <Link href="/" className="text-sm text-primary hover:underline">← Volver al inicio</Link>
        </div>

      </main>

      <footer className="border-t border-border/50 py-8 px-6 text-center">
        <p className="text-xs text-muted-foreground">🌭 SalchiNeta · Política de Privacidad</p>
      </footer>

    </div>
  )
}
