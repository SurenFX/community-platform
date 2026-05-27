import { Module } from '@nestjs/common'
import { MissionsService } from './missions.service'

@Module({
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule {}
