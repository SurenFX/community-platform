import { Module } from '@nestjs/common'
import { WeeklyDigestService } from './weekly-digest.service'
import { DiscordBotModule } from '../discord-bot/discord-bot.module'
import { TelegramModule } from '../telegram/telegram.module'

@Module({
  imports:   [DiscordBotModule, TelegramModule],
  providers: [WeeklyDigestService],
})
export class WeeklyDigestModule {}
