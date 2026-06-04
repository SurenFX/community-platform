import { Module } from '@nestjs/common'
import { TelegramService } from './telegram.service'
import { ReputationModule } from '../reputation/reputation.module'

@Module({
  imports:   [ReputationModule],
  providers: [TelegramService],
  exports:   [TelegramService],
})
export class TelegramModule {}
