import { Module } from '@nestjs/common'
import { TwitchIrcService } from './twitch-irc.service'
import { TwitchApiService } from './twitch-api.service'
import { TwitchController } from './twitch.controller'
import { ReputationModule } from '../reputation/reputation.module'
import { DiscordBotModule } from '../discord-bot/discord-bot.module'
import { RedisModule } from '../../infrastructure/redis/redis.module'

@Module({
  imports: [ReputationModule, DiscordBotModule, RedisModule],
  controllers: [TwitchController],
  providers: [TwitchIrcService, TwitchApiService],
  exports: [TwitchIrcService, TwitchApiService],
})
export class TwitchModule {}
