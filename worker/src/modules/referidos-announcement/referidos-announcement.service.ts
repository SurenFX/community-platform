import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { EmbedBuilder } from 'discord.js'
import { DiscordBotService } from '../discord-bot/discord-bot.service'
import { TelegramService } from '../telegram/telegram.service'
import { RedisService } from '../../infrastructure/redis/redis.service'

const REDIS_KEY_DISCORD  = 'referidos:discord:last_msg_id'
const REDIS_KEY_TELEGRAM = 'referidos:telegram:last_msg_id'

@Injectable()
export class ReferidosAnnouncementService {
  private readonly logger = new Logger(ReferidosAnnouncementService.name)

  constructor(
    private config:     ConfigService,
    private discordBot: DiscordBotService,
    private telegram:   TelegramService,
    private redis:      RedisService,
  ) {}

  @Cron('0 */4 * * *')
  async sendAnnouncement() {
    await this.sendToDiscord()
    await this.sendToTelegram()
  }

  private async sendToDiscord() {
    try {
      const channelId = this.config.get<string>('DISCORD_REFERIDOS_CHANNEL_ID')
      if (!channelId) {
        this.logger.warn('DISCORD_REFERIDOS_CHANNEL_ID no configurado -- se omite el aviso en Discord')
        return
      }

      const hubUrl = this.config.get<string>('HUB_URL') ?? ''
      const referidosUrl = `${hubUrl}/referidos`

      const embed = new EmbedBuilder()
        .setColor(0x53FC18)
        .setTitle('🎮 Juegos recomendados por Salchi')
        .setDescription(
          `Registrate en estos juegos usando el link de Salchi y apoyalo!\n\n` +
          `👉 [Ver juegos con referido](${referidosUrl})`
        )
        .setURL(referidosUrl)

      const prevId = await this.redis.get(REDIS_KEY_DISCORD)
      const newId  = await this.discordBot.sendReplaceable(channelId, embed, prevId)

      if (newId) {
        await this.redis.set(REDIS_KEY_DISCORD, newId)
        this.logger.log('Anuncio de referidos enviado a Discord')
      }
    } catch (err) {
      this.logger.warn(`sendToDiscord error: ${err}`)
    }
  }

  private async sendToTelegram() {
    try {
      const chatId = this.config.get<string>('TELEGRAM_GROUP_ID')
      if (!chatId) {
        this.logger.warn('TELEGRAM_GROUP_ID no configurado -- se omite el aviso en Telegram')
        return
      }

      const hubUrl = this.config.get<string>('HUB_URL') ?? ''
      const referidosUrl = `${hubUrl}/referidos`

      const message =
        `🎮 *Juegos recomendados por Salchi*\n\n` +
        `Registrate en estos juegos usando el link de Salchi y apoyalo\\!\n\n` +
        `👉 [Ver juegos con referido](${referidosUrl})`

      const prevId = await this.redis.get(REDIS_KEY_TELEGRAM)
      const newId  = await this.telegram.sendReplaceable(chatId, message, '1', prevId)

      if (newId) {
        await this.redis.set(REDIS_KEY_TELEGRAM, newId)
        this.logger.log('Anuncio de referidos enviado a Telegram')
      }
    } catch (err) {
      this.logger.warn(`sendToTelegram error: ${err}`)
    }
  }
}
