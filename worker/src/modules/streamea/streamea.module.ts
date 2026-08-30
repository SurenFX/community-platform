import { Module } from '@nestjs/common'
import { StreameaKickService } from './streamea-kick.service'
import { StreameaTwitchService } from './streamea-twitch.service'
import { StreameaController } from './streamea.controller'
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module'

@Module({
  imports:     [SupabaseModule],
  controllers: [StreameaController],
  providers:   [StreameaKickService, StreameaTwitchService],
  exports:     [StreameaKickService, StreameaTwitchService],
})
export class StreameaModule {}
