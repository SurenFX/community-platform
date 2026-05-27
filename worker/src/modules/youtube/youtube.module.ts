import { Module } from '@nestjs/common'
import { YoutubeService } from './youtube.service'
import { YoutubeController } from './youtube.controller'
import { ReputationModule } from '../reputation/reputation.module'

@Module({
  imports: [ReputationModule],
  controllers: [YoutubeController],
  providers: [YoutubeService],
  exports: [YoutubeService],
})
export class YoutubeModule {}
