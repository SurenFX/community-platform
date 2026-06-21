import { Module } from '@nestjs/common'
import { RecruitmentService } from './recruitment.service'
import { DiscordBotModule } from '../discord-bot/discord-bot.module'
import { TelegramModule } from '../telegram/telegram.module'

@Module({
  imports:   [DiscordBotModule, TelegramModule],
  providers: [RecruitmentService],
})
export class RecruitmentModule {}
