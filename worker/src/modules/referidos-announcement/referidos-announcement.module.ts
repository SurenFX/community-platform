import { Module } from '@nestjs/common'
import { ReferidosAnnouncementService } from './referidos-announcement.service'
import { DiscordBotModule } from '../discord-bot/discord-bot.module'
import { TelegramModule } from '../telegram/telegram.module'

@Module({
  imports:   [DiscordBotModule, TelegramModule],
  providers: [ReferidosAnnouncementService],
})
export class ReferidosAnnouncementModule {}
