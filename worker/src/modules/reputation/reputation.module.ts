import { Module } from '@nestjs/common'
import { ReputationService } from './reputation.service'
import { AntiSpamService } from './anti-spam.service'
import { XpCalculatorService } from './xp-calculator.service'

@Module({
  providers: [ReputationService, AntiSpamService, XpCalculatorService],
  exports: [ReputationService],
})
export class ReputationModule {}
