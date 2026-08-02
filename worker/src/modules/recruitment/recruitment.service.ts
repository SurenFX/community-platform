import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { EmbedBuilder } from 'discord.js'
import { DiscordBotService } from '../discord-bot/discord-bot.service'
import { TelegramService } from '../telegram/telegram.service'
import { RedisService } from '../../infrastructure/redis/redis.service'

const MESSAGE =
  'Si estás buscando unirte a la SalchiNeta (SN), los cupos están llenos y poco a poco irán ' +
  'entrando algunos en función de su actividad en la comunidad (Discord, Telegram, YT, Kick, Twitch).\n\n' +
  'Para quienes ya son miembros de SN, recuerden ayudar a los demás y colaborar con el clan. ' +
  'Como mínimo tener 1k de oro donado en promedio y haber donado al menos 1200 materiales en la ' +
  'fortaleza de clan!! Quien necesite ayuda la pide sin problema.\n\n' +
  'Saludos y sean felices 🙂'

const REDIS_KEY_DISCORD  = 'recruitment:discord:last_msg_id'
const REDIS_KEY_TELEGRAM = 'recruitment:telegram:last_msg_id'

@Injectable()
export class RecruitmentService {
  private readonly logger = new Logger(RecruitmentService.name)

  constructor(
    private config:     ConfigService,
    private discordBot: DiscordBotService,
    private telegram:   TelegramService,
    private redis:      RedisService,
  ) {}

  @Cron('0 */4 * * *')
  async sendReminder() {
    await this.sendToDiscord()
    await this.sendToTelegram()
  }

  private async sendToDiscord() {
    try {
      const channelId = this.config.get<string>('DISCORD_RECRUITMENT_CHANNEL_ID')
      if (!channelId) {
        this.logger.warn('DISCORD_RECRUITMENT_CHANNEL_ID no configurado -- se omite el aviso en Discord')
        return
      }

      const embed = new EmbedBuilder()
        .setColor(0x53FC18)
        .setDescription(MESSAGE)

      const prevId = await this.redis.get(REDIS_KEY_DISCORD)
      const newId  = await this.discordBot.sendReplaceable(channelId, embed, prevId)

      if (newId) {
        await this.redis.set(REDIS_KEY_DISCORD, newId)
        this.logger.log('Recordatorio de reclutamiento enviado a Discord')
      }
    } catch (err) {
      this.logger.warn(`sendToDiscord error: ${err}`)
    }
  }

  private async sendToTelegram() {
    try {
      const chatId = this.config.get<string>('TELEGRAM_RECRUITMENT_CHAT_ID')
        ?? this.config.get<string>('TELEGRAM_GROUP_ID')
      const threadId = this.config.get<string>('TELEGRAM_RECRUITMENT_THREAD_ID')

      if (!chatId) {
        this.logger.warn('TELEGRAM_RECRUITMENT_CHAT_ID / TELEGRAM_GROUP_ID no configurado -- se omite el aviso en Telegram')
        return
      }

      const prevId = await this.redis.get(REDIS_KEY_TELEGRAM)
      const newId  = await this.telegram.sendReplaceable(chatId, MESSAGE, threadId, prevId)

      if (newId) {
        await this.redis.set(REDIS_KEY_TELEGRAM, newId)
        this.logger.log('Recordatorio de reclutamiento enviado a Telegram')
      }
    } catch (err) {
      this.logger.warn(`sendToTelegram error: ${err}`)
    }
  }
}
