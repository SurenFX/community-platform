import { Module } from '@nestjs/common'
import { SchedulerService } from './scheduler.service'
import { ReputationModule } from '../reputation/reputation.module'

@Module({
  imports:   [ReputationModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
