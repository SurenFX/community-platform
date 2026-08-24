import { Module } from '@nestjs/common'
import { StreameaKickService } from './streamea-kick.service'
import { StreameaController } from './streamea.controller'
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module'

@Module({
  imports:     [SupabaseModule],
  controllers: [StreameaController],
  providers:   [StreameaKickService],
  exports:     [StreameaKickService],
})
export class StreameaModule {}
