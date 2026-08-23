import { Gift, Zap, MessageSquare, Shield, ArrowRight } from 'lucide-react'

const FEATURES = [
  {
    icon: Zap,
    title: 'Sorteo en segundos',
    text: 'Elegís una palabra clave, la anunciás y el bot registra a todos los que la escriban en el chat. Cerrás y elegís ganador con un clic.',
  },
  {
    icon: MessageSquare,
    title: 'Kick y Twitch',
    text: 'Funciona en los dos chats a la vez. Conectás tus cuentas con un clic — sin tokens, sin configurar APIs, sin OBS.',
  },
  {
    icon: Shield,
    title: 'Sin trampas',
    text: 'Una entrada por persona, registro con timestamp, y el ganador se elige al azar de forma verificable.',
  },
]

export default function Landing() {
  return (
    <main className="mx-auto max-w-4xl px-6">
      {/* Hero */}
      <section className="flex flex-col items-center pt-24 pb-16 text-center">
        <div className="mb-6 flex items-center gap-3">
          <Gift className="h-10 w-10 text-brand" />
          <span className="text-3xl font-bold tracking-tight">Sortea</span>
        </div>
        <h1 className="max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">
          Sorteos en vivo para tu stream,{' '}
          <span className="text-brand">sin complicarte</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-zinc-400">
          Lanzá sorteos por palabra clave en tu chat de{' '}
          <span className="font-semibold text-brand-kick">Kick</span> y{' '}
          <span className="font-semibold text-brand-twitch">Twitch</span> en
          segundos. Vos streameás, Sortea se encarga del resto.
        </p>
        <a
          href="#early"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand-hover"
        >
          Quiero acceso anticipado <ArrowRight className="h-4 w-4" />
        </a>
        <p className="mt-3 text-sm text-zinc-500">
          Gratis durante la beta · sin tarjeta
        </p>
      </section>

      {/* Features */}
      <section className="grid gap-6 pb-20 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="rounded-2xl border border-surface-border bg-surface-raised p-6"
          >
            <Icon className="mb-4 h-7 w-7 text-brand" />
            <h3 className="mb-2 font-semibold">{title}</h3>
            <p className="text-sm leading-relaxed text-zinc-400">{text}</p>
          </div>
        ))}
      </section>

      {/* Cómo funciona */}
      <section className="pb-20">
        <h2 className="mb-8 text-center text-2xl font-bold">Cómo funciona</h2>
        <ol className="mx-auto max-w-md space-y-4">
          {[
            'Conectá tu cuenta de Kick o Twitch (un clic, OAuth oficial).',
            'Escribí la palabra clave y arrancá el sorteo desde tu panel.',
            'Tu chat participa escribiendo la palabra. Todo se registra solo.',
            'Cerrá el sorteo y elegí ganador al azar. El bot lo anuncia en el chat.',
          ].map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                {i + 1}
              </span>
              <span className="text-zinc-300">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA acceso anticipado */}
      <section id="early" className="pb-24">
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-8 text-center">
          <h2 className="text-2xl font-bold">Acceso anticipado</h2>
          <p className="mx-auto mt-3 max-w-md text-zinc-400">
            Estamos abriendo Sortea con un grupo chico de streamers. Si querés
            probarlo en tu canal, escribinos y te sumamos a la beta.
          </p>
          <a
            href="mailto:goldennftproject@gmail.com?subject=Quiero%20probar%20Sortea"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand-hover"
          >
            Pedir acceso <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <footer className="border-t border-surface-border py-8 text-center text-sm text-zinc-500">
        Sortea · hecho por streamers, para streamers
      </footer>
    </main>
  )
}
