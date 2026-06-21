import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { EmbedBuilder } from 'discord.js'
import { DiscordBotService } from '../discord-bot/discord-bot.service'
import { TelegramService } from '../telegram/telegram.service'

const MESSAGE =
  'Si estás buscando pertenecer al mejor clan de todos, lamento informarte que ' +
  'estamos cortos de cupos. Pero no desesperes, te recomiendo que te sumes a la ' +
  'comunidad, aquí y/o Discord para estar al tanto de cuando se liberen espacios! ' +
  '(apoyar la creación de contenido en los stream o dejando like y comentando ' +
  'videos sumarás puntos para darte prioridad ;) )'

@Injectable()
export class RecruitmentService {
  private readonly logger = new Logger(RecruitmentService.name)

  constructor(
    private config:     ConfigService,
    private discordBot: DiscordBotService,
    private telegram:   TelegramService,
  ) {}

  // Recordatorio de reclutamiento cada 2 horas
  @Cron('0 */2 * * *')
  async sendReminder() {
    try {
      const discordChannelId = this.config.get<string>('DISCORD_RECRUITMENT_CHANNEL_ID')

      if (discordChannelId) {
        const embed = new EmbedBuilder()
          .setColor(0x53FC18)
          .setDescription(MESSAGE)

        await this.discordBot.announce(discordChannelId, embed)
        this.logger.log('Recordatorio de reclutamiento enviado a Discord')
      } else {
        this.logger.warn('DISCORD_RECRUITMENT_CHANNEL_ID no configurado -- se omite el aviso en Discord')
      }

      await this.telegram.announce(MESSAGE, 'TELEGRAM_RECRUITMENT_THREAD_ID')
      this.logger.log('Recordatorio de reclutamiento enviado a Telegram')
    } catch (err) {
      this.logger.warn(`sendReminder error: ${err}`)
    }
  }
}
