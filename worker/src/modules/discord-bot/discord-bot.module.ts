import { Module } from '@nestjs/common'
import { DiscordBotService } from './discord-bot.service'
import { ReputationModule } from '../reputation/reputation.module'
import { RedisModule } from '../../infrastructure/redis/redis.module'

@Module({
  imports: [ReputationModule, RedisModule],
  providers: [DiscordBotService],
  exports: [DiscordBotService],
})
export class DiscordBotModule {}
