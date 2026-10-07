import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'
import { saveDestination, toggleDestination } from './actions'
export const dynamic = 'force-dynamic'
const field = 'mt-2 w-full rounded-xl border border-surface-border bg-surface p-3 text-sm'
const button = 'rounded-xl border border-brand/40 px-4 py-2 text-sm text-brand'

export default async function Destinos({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const { result } = await searchParams
  const client = await createSupabaseServer()
  const { data: { user } } = await client.auth.getUser()
  if (!user) redirect('/login')
  const { data: streamer } = await client.from('st_streamers').select('id').eq('user_id', user.id).maybeSingle()
  if (!streamer) redirect('/panel')
  const { data, error } = await createSupabaseAdmin().from('st_social_destinations')
    .select('platform,is_active').eq('streamer_id', streamer.id)
  const feedback: Record<string,string> = {
    saved: 'Destino guardado. Sus avisos quedaron en pausa; activalos desde Avisos cuando estés listo. Guardar no envía mensajes.',
    updated: 'Estado del destino actualizado.', invalid: 'Revisá la URL de Discord o el token y el ID numérico de Telegram.',
    failed: 'No pudimos guardar el cambio. Intentá de nuevo.',
  }
  return <main><h1 className="text-2xl font-bold">Destinos</h1>
    <p className="mt-2 text-zinc-400">Discord y Telegram son opcionales. Conectá un destino y creá tus mensajes desde <a href="/panel/avisos" className="text-brand underline">Avisos</a>.</p>
    <p className="mt-3 text-sm text-zinc-400">Los avisos esperan el intervalo y la actividad de tus chats de Kick o Twitch. Si tus chats están quietos, no se envían. La configuración guardada necesita un primer envío exitoso para confirmar que funciona.</p>
    {result && feedback[result] && <p role="status" className="mt-4 rounded-xl border border-surface-border p-4 text-sm">{feedback[result]}</p>}
    {error ? <p role="alert" className="mt-4 text-red-400">No pudimos cargar los destinos.</p> : ['DISCORD','TELEGRAM'].map(platform => {
      const destination = data?.find(row => row.platform === platform)
      return <section key={platform} className="mt-6 rounded-2xl border border-surface-border bg-surface-raised p-5">
        <h2 className="font-semibold">{platform === 'DISCORD' ? 'Discord' : 'Telegram'}</h2>
        <p className="mt-2 text-sm text-zinc-400">{destination ? destination.is_active ? 'Configurado · habilitado' : 'Configurado · pausado' : 'Sin configurar'}</p>
        {destination && <form action={toggleDestination} className="mt-3"><input type="hidden" name="platform" value={platform} /><input type="hidden" name="enable" value={String(!destination.is_active)} /><button className={button}>{destination.is_active ? 'Pausar destino' : 'Habilitar destino'}</button></form>}
        <details className="mt-4" open={!destination}><summary className="cursor-pointer text-sm text-brand">{destination ? 'Reemplazar configuración' : 'Configurar'}</summary>
          <form action={saveDestination} className="mt-4 space-y-4"><input type="hidden" name="platform" value={platform} />
            {platform === 'DISCORD' ? <><p className="text-sm text-zinc-400">En tu canal de texto de Discord, abrí Integraciones → Webhooks y copiá la URL del webhook. No se requiere una cuenta bot.</p><label className="block text-sm">URL del webhook<input name="webhook" type="password" required autoComplete="off" className={field} /></label></>
              : <><p className="text-sm text-zinc-400">Usá el token de tu bot de Telegram y el ID numérico del grupo o canal. El bot necesita permiso para publicar allí.</p><label className="block text-sm">Token del bot<input name="token" type="password" required autoComplete="off" className={field} /></label><label className="block text-sm">ID del grupo o canal<input name="chat_id" required placeholder="-100…" className={field} /></label></>}
            <button className={button}>Guardar destino y pausar sus avisos</button>
          </form>
        </details>
      </section>
    })}
  </main>
}
