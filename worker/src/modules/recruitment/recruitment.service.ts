import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { EmbedBuilder } from 'discord.js'
import { DiscordBotService } from '../discord-bot/discord-bot.service'
import { TelegramService } from '../telegram/telegram.service'
import { RedisService } from '../../infrastructure/redis/redis.service'

const MESSAGE =
  'Si estás buscando unirte al mejor clan, los cupos están cerrados por ahora 😔 ' +
  'Pero como bien dijo el crack de Manuel, si querés entrar cuando se libere un lugar, estos son los requisitos:\n\n' +
  '⚔️ 150 bichos diarios y 500 de oro (si no llegás con los bichos, compensás con más oro)\n' +
  '🛡️ Si no sos super tank ni tenés super ATK, al menos tener maldición nivel 1 para la cueva del clan\n' +
  '📺 Participar en los directos en Kick y Twitch, y estar activo en Discord\n' +
  '🏴 Estar en las batallas de clanes y ayudar a conquistar territorios — ¡estamos en guerra fuerte!'

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
