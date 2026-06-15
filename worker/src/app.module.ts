import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { SupabaseModule } from './infrastructure/supabase/supabase.module'
import { RedisModule } from './infrastructure/redis/redis.module'
import { ReputationModule } from './modules/reputation/reputation.module'
import { DiscordBotModule } from './modules/discord-bot/discord-bot.module'
import { MissionsModule } from './modules/missions/missions.module'
import { SchedulerModule } from './modules/scheduler/scheduler.module'
import { YoutubeModule } from './modules/youtube/youtube.module'
import { TwitchModule } from './modules/twitch/twitch.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { TelegramModule } from './modules/telegram/telegram.module'
import { KickModule } from './modules/kick/kick.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    SupabaseModule,
    RedisModule,
    ReputationModule,
    DiscordBotModule,
    MissionsModule,
    SchedulerModule,
    YoutubeModule,
    TwitchModule,
    NotificationsModule,
    TelegramModule,
    KickModule,
  ],
})
export class AppModule {}
