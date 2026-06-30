import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { EmbedBuilder } from 'discord.js'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'
import { DiscordBotService } from '../discord-bot/discord-bot.service'
import { TelegramService } from '../telegram/telegram.service'

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']

@Injectable()
export class WeeklyDigestService {
  private readonly logger = new Logger(WeeklyDigestService.name)

  constructor(
    private config:     ConfigService,
    private supabase:   SupabaseService,
    private discordBot: DiscordBotService,
    private telegram:   TelegramService,
  ) {}

  // Cada lunes a las 12:00 UTC
  @Cron('0 12 * * 1')
  async sendWeeklyDigest() {
    try {
      this.logger.log('Enviando digest semanal...')

      const { data, error } = await this.supabase.db
        .from('user_reputation')
        .select('weekly_xp, user_id, profiles!inner(username)')
        .order('weekly_xp', { ascending: false })
        .gt('weekly_xp', 0)
        .limit(5)

      if (error) {
        this.logger.error(`Error consultando top semanal: ${error.message}`)
        return
      }

      if (!data?.length) {
        this.logger.warn('No hay actividad esta semana — se omite el digest')
        return
      }

      const lines = (data as any[]).map((row, i) => {
        const username = (row.profiles as any)?.username ?? 'Desconocido'
        const xp = Number(row.weekly_xp).toLocaleString('es-AR')
        return { medal: MEDALS[i], username, xp }
      })

      // ── Discord ──────────────────────────────────────────────
      const channelId = this.config.get<string>('DISCORD_DIGEST_CHANNEL_ID')
      if (channelId) {
        const description = lines
          .map(l => `${l.medal} **${l.username}** — ${l.xp} XP`)
          .join('\n')

        const embed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('📊 Top 5 de la semana')
          .setDescription(description + '\n\n*¡Seguí participando para aparecer en el próximo ranking semanal!*')
          .setTimestamp()

        await this.discordBot.announce(channelId, embed)
        this.logger.log('Digest semanal enviado a Discord')
      }

      // ── Telegram ─────────────────────────────────────────────
      const tgLines = lines
        .map(l => `${l.medal} <b>${l.username}</b> — ${l.xp} XP`)
        .join('\n')

      await this.telegram.announce(
        `📊 <b>Top 5 de la semana</b>\n\n${tgLines}\n\n<i>¡Seguí participando para aparecer la próxima semana!</i>`,
        'TELEGRAM_DIGEST_THREAD_ID',
      )
      this.logger.log('Digest semanal enviado a Telegram')

    } catch (err) {
      this.logger.error(`sendWeeklyDigest error: ${err}`)
    }
  }
}
