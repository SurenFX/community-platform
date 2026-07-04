import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Polyfill WebSocket para Node.js < 22 (sin WebSocket nativo).
// Debe estar al nivel de módulo para que se ejecute antes de createClient.
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (typeof globalThis.WebSocket === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ;(globalThis as any).WebSocket = require('ws')
}

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
