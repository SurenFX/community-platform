import { createClient } from '@/lib/supabase/server'
import MissionsAdmin from '@/components/admin/MissionsAdmin'

export default async function AdminMissionsPage() {
  const supabase = await createClient()

  const { data: missions } = await supabase
    .from('missions')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Misiones</h1>
        <p className="text-muted-foreground mt-1 text-sm">Creá y gestioná misiones para la comunidad</p>
      </div>
      <MissionsAdmin missions={missions ?? []} />
    </div>
  )
}
