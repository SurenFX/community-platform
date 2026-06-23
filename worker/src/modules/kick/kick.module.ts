import { Module } from '@nestjs/common'
import { KickApiService } from './kick-api.service'
import { KickController } from './kick.controller'
import { ReputationModule } from '../reputation/reputation.module'
import { DiscordBotModule } from '../discord-bot/discord-bot.module'
import { TelegramModule } from '../telegram/telegram.module'
import { RedisModule } from '../../infrastructure/redis/redis.module'

@Module({
  imports:     [ReputationModule, DiscordBotModule, TelegramModule, RedisModule],
  controllers: [KickController],
  providers:   [KickApiService],
  exports:     [KickApiService],
})
export class KickModule {}
