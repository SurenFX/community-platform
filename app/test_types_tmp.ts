import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

const supabase = createBrowserClient<Database>('http://x', 'y')
async function test() {
  const { data } = await supabase.from('xp_events').select('xp_awarded').limit(1)
  if (data) console.log(data[0].xp_awarded)
  const { data: profile } = await supabase.from('profiles').select('is_admin').single()
  if (profile) console.log(profile.is_admin)
}
