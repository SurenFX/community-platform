import { Module } from '@nestjs/common'
import { YoutubeService } from './youtube.service'
import { YoutubeController } from './youtube.controller'
import { ReputationModule } from '../reputation/reputation.module'
import { DiscordBotModule } from '../discord-bot/discord-bot.module'
import { TelegramModule } from '../telegram/telegram.module'
import { RedisModule } from '../../infrastructure/redis/redis.module'
import { TwitchModule } from '../twitch/twitch.module'
import { KickModule } from '../kick/kick.module'

@Module({
  imports: [ReputationModule, DiscordBotModule, TelegramModule, RedisModule, TwitchModule, KickModule],
  controllers: [YoutubeController],
  providers: [YoutubeService],
  exports: [YoutubeService],
})
export class YoutubeModule {}
