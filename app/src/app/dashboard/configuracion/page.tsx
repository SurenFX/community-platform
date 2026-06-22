import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConnectedAccounts from '@/components/settings/ConnectedAccounts'

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams

  const [profileRes, socialLinksRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('user_social_links').select('*').eq('user_id', user.id),
  ])

  const identitiesRes = await supabase.auth.getUserIdentities()
  const identities = identitiesRes.data?.identities ?? []

  const ERROR_MESSAGES: Record<string, string> = {
    no_token:    'No se pudo obtener el token. Intentá conectar de nuevo.',
    youtube_api: 'Error al acceder a YouTube. Verificá que tu cuenta tenga un canal.',
    no_channel:  'Tu cuenta de Google no tiene un canal de YouTube asociado.',
    db_error:    'Error al guardar la conexión. Intentá de nuevo.',
    unknown:     'Ocurrió un error inesperado. Intentá de nuevo.',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Conectá tus cuentas para ganar XP en todas las plataformas
        </p>
      </div>
      <ConnectedAccounts
        userId={user.id}
        profile={profileRes.data}
        socialLinks={socialLinksRes.data ?? []}
        identities={identities}
        successMessage={params.connected
          ? `¡${{ youtube: 'YouTube', kick: 'Kick' }[params.connected] ?? params.connected} conectado correctamente!`
          : null
        }
        errorMessage={params.error
          ? (ERROR_MESSAGES[params.error] ?? ERROR_MESSAGES.unknown)
          : null
        }
      />
    </div>
  )
}
