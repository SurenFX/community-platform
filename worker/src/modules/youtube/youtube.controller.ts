import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { YoutubeService } from './youtube.service'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'

@Controller('youtube')
export class YoutubeController {
  constructor(
    private youtube:  YoutubeService,
    private supabase: SupabaseService,
    private config:   ConfigService,
  ) {}

  @Post('connected')
  async onYoutubeConnected(
    @Headers('x-worker-secret') secret: string,
    @Body() body: { userId: string; discordId: string; ytId: string },
  ) {
    // Verificar que la request viene de Next.js
    if (secret !== this.config.get('WORKER_SECRET')) {
      throw new UnauthorizedException()
    }

    const { userId, discordId, ytId } = body

    // Guardar el link de YouTube en la DB
    await this.supabase.db
      .from('user_social_links')
      .upsert({
        user_id:     userId,
        platform:    'YOUTUBE',
        external_id: ytId,
        username:    ytId,
        is_verified: true,
      }, { onConflict: 'user_id,platform' })

    return { ok: true }
  }
}
