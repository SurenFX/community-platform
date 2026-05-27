import { Module } from '@nestjs/common'
import { DiscordBotService } from './discord-bot.service'
import { ReputationModule } from '../reputation/reputation.module'

@Module({
  imports: [ReputationModule],
  providers: [DiscordBotService],
})
export class DiscordBotModule {}
