import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TwitchIrcService } from './twitch-irc.service'

@Controller('twitch')
export class TwitchController {
  constructor(
    private irc:    TwitchIrcService,
    private config: ConfigService,
  ) {}

  private verify(secret: string) {
    if (secret !== this.config.get('WORKER_SECRET')) throw new UnauthorizedException()
  }

  @Post('raffle/start')
  async raffleStart(
    @Headers('x-worker-secret') secret: string,
    @Body() body: { keyword: string },
  ) {
    this.verify(secret)
    await this.irc.announceRaffleStart(body.keyword)
    return { ok: true }
  }

  @Post('raffle/winner')
  async raffleWinner(
    @Headers('x-worker-secret') secret: string,
    @Body() body: { winner: string },
  ) {
    this.verify(secret)
    await this.irc.announceRaffleWinner(body.winner)
    return { ok: true }
  }
}
