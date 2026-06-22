import { Module } from '@nestjs/common'
import { KickApiService } from './kick-api.service'
import { KickController } from './kick.controller'
import { ReputationModule } from '../reputation/reputation.module'

@Module({
  imports:     [ReputationModule],
  controllers: [KickController],
  providers:   [KickApiService],
  exports:     [KickApiService],
})
export class KickModule {}
