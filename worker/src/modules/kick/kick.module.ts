import { Module } from '@nestjs/common'
import { KickApiService } from './kick-api.service'
import { KickController } from './kick.controller'

@Module({
  controllers: [KickController],
  providers:   [KickApiService],
  exports:     [KickApiService],
})
export class KickModule {}
