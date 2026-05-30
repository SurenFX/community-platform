import { Module } from '@nestjs/common'
import { TwitchIrcService } from './twitch-irc.service'
import { TwitchApiService } from './twitch-api.service'
import { ReputationModule } from '../reputation/reputation.module'

@Module({
  imports: [ReputationModule],
  providers: [TwitchIrcService, TwitchApiService],
  exports: [TwitchIrcService, TwitchApiService],
})
export class TwitchModule {}
