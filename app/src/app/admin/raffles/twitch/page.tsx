import { createClient } from '@/lib/supabase/server'
import TwitchRaffle from '@/components/raffles/TwitchRaffle'

export default async function AdminTwitchRafflePage() {
  const supabase = await createClient()

  // Canales disponibles: canal principal + amigos streamers con Twitch
  const { data: friends } = await supabase
    .from('friend_streamers')
    .select('name, twitch_login')
    .not('twitch_login', 'is', null)
    .eq('is_active', true)
    .order('name')

  const channels = [
    { login: 'salchinft', label: 'salchinft (principal)' },
    ...((friends ?? [])
      .filter((f: any) => f.twitch_login)
      .map((f: any) => ({ login: f.twitch_login as string, label: `${f.name} (${f.twitch_login})` }))
    ),
  ]

  return <TwitchRaffle backHref="/admin/raffles" channels={channels} />
}
