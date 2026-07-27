import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TwitchRaffle from '@/components/raffles/TwitchRaffle'
import { Twitch } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Sorteo Twitch — Community Hub' }

export default async function SorteoTwitchPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Buscar el Twitch conectado del usuario
  const { data: twitchLink } = await supabase
    .from('user_social_links')
    .select('username')
    .eq('user_id', user.id)
    .eq('platform', 'TWITCH')
    .single()

  // Verificar que sea un amigo streamer activo
  const { data: friendStreamer } = twitchLink
    ? await supabase
        .from('friend_streamers')
        .select('name, twitch_login')
        .eq('twitch_login', twitchLink.username)
        .eq('is_active', true)
        .single()
    : { data: null }

  // Si no tiene Twitch conectado o no es streamer amigo: mostrar instrucciones
  if (!twitchLink || !friendStreamer) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#9146FF]/10 border border-[#9146FF]/20 flex items-center justify-center mx-auto">
          <Twitch className="w-8 h-8 text-[#9146FF]" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Sorteos en tu canal de Twitch</h1>
          <p className="text-muted-foreground">
            Esta herramienta te permite hacer sorteos en vivo en tu propio chat de Twitch,
            integrado con el Hub de la SalchiNeta.
          </p>
        </div>

        {!twitchLink ? (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 text-left">
            <p className="text-sm font-semibold text-foreground">Paso 1: Conectá tu Twitch</p>
            <p className="text-sm text-muted-foreground">
              Necesitás conectar tu cuenta de Twitch en la página de configuración para que
              el Hub pueda identificarte como streamer.
            </p>
            <Link
              href="/dashboard/configuracion"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#9146FF] text-white text-sm font-semibold rounded-lg hover:bg-[#7c3bd4] transition-colors"
            >
              <Twitch className="w-4 h-4" />
              Ir a Configuración → Conectar Twitch
            </Link>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-3 text-left">
            <p className="text-sm font-semibold text-foreground">Tu Twitch está conectado ✓</p>
            <p className="text-sm text-muted-foreground">
              Tu cuenta <span className="text-foreground font-medium">@{twitchLink.username}</span> está vinculada,
              pero no está registrada como streamer amigo del Hub todavía.
              Pedile a Salchi que te agregue en el panel de amigos streamers.
            </p>
          </div>
        )}
      </div>
    )
  }

  // Es un streamer autorizado → mostrar herramienta de sorteo para su canal
  return (
    <TwitchRaffle
      backHref="/dashboard"
      fixedChannel={friendStreamer.twitch_login}
      channels={[{ login: friendStreamer.twitch_login, label: friendStreamer.twitch_login }]}
    />
  )
}
