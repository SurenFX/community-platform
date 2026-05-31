import { createClient } from '@/lib/supabase/server'
import XpConfigAdmin from '@/components/admin/XpConfigAdmin'

export default async function AdminXpConfigPage() {
  const supabase = await createClient()
  const { data: configs } = await supabase
    .from('xp_config')
    .select('*')
    .order('event_type')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración XP</h1>
        <p className="text-muted-foreground mt-1 text-sm">Ajustá el XP base, cooldowns y límites diarios por evento</p>
      </div>
      <XpConfigAdmin configs={configs ?? []} />
    </div>
  )
}
