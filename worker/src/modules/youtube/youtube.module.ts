import { Module } from '@nestjs/common'
import { YoutubeService } from './youtube.service'
import { YoutubeController } from './youtube.controller'
import { ReputationModule } from '../reputation/reputation.module'
import { DiscordBotModule } from '../discord-bot/discord-bot.module'
import { RedisModule } from '../../infrastructure/redis/redis.module'

@Module({
  imports: [ReputationModule, DiscordBotModule, RedisModule],
  controllers: [YoutubeController],
  providers: [YoutubeService],
  exports: [YoutubeService],
})
export class YoutubeModule {}
