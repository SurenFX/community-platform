import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('SUPABASE_URL')
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')

    if (!url || !key) {
      throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env')
    }

    // Service role client — bypassa RLS completamente
    // NUNCA exponer esta instancia al frontend
    this.client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    console.log('✓ Supabase conectado')
  }

  get db(): SupabaseClient {
    return this.client
  }
}
