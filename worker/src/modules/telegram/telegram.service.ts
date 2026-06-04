import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Telegraf, Context } from 'telegraf'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'
import { ReputationService } from '../reputation/reputation.service'

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name)
  private bot: Telegraf | null = null

  constructor(
    private config:     ConfigService,
    private supabase:   SupabaseService,
    private reputation: ReputationService,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN')
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN no configurado — bot desactivado')
      return
    }

    this.bot = new Telegraf(token)
    this.registerListeners()

    // Lanzar el bot en modo polling
    this.bot.launch().catch(err => {
      this.logger.error(`Error lanzando bot de Telegram: ${err}`)
    })

    this.logger.log('✓ Telegram bot conectado')
  }

  async onModuleDestroy() {
    this.bot?.stop('SIGTERM')
  }

  private registerListeners() {
    if (!this.bot) return

    // Escuchar mensajes de texto en grupos
    this.bot.on('text', async (ctx: Context) => {
      try {
        const msg = ctx.message as any
        if (!msg) return

        // Solo procesar mensajes de grupos/supergrupos
        const chatType = msg.chat?.type
        if (chatType !== 'group' && chatType !== 'supergroup') return

        const telegramUserId = String(msg.from?.id)
        const chatId         = String(msg.chat?.id)
        const messageId      = String(msg.message_id)
        const text           = msg.text ?? ''

        // Verificar que el grupo configurado sea el correcto
        const configuredChatId = this.config.get<string>('TELEGRAM_GROUP_ID')
        if (configuredChatId && chatId !== configuredChatId) return

        // Si el bot aún no tiene el grupo configurado, loguearlo para que el admin lo sepa
        if (!configuredChatId) {
          this.logger.log(`Mensaje en grupo ${chatId} de @${msg.from?.username} — configurá TELEGRAM_GROUP_ID=${chatId}`)
        }

        // Buscar el usuario por su Telegram ID vinculado
        const { data: socialLink } = await this.supabase.db
          .from('user_social_links')
          .select('user_id, profiles!inner(discord_id)')
          .eq('platform', 'TELEGRAM')
          .eq('external_id', telegramUserId)
          .single()

        if (!socialLink) return

        const discordId = (socialLink as any).profiles?.discord_id
        if (!discordId) return

        await this.reputation.processXpEvent({
          discordId,
          eventType:   'TELEGRAM_MESSAGE',
          platform:    'TELEGRAM',
          externalRef: `tg_${chatId}_${messageId}`,
          metadata: {
            telegram_user_id: telegramUserId,
            chat_id:          chatId,
            text:             text.slice(0, 200),
          },
        })

      } catch (err) {
        this.logger.warn(`Error procesando mensaje Telegram: ${err}`)
      }
    })

    // Comando /vincular — para que el usuario vincule su cuenta
    this.bot.command('vincular', async (ctx: Context) => {
      const msg = ctx.message as any
      if (!msg) return

      const telegramUserId = String(msg.from?.id)
      const username       = msg.from?.username ?? msg.from?.first_name ?? 'Usuario'

      // Generar un código de vinculación temporal en Redis/DB
      try {
        await this.supabase.db
          .from('platform_config')
          .upsert({
            key:   `tg_link_${telegramUserId}`,
            value: username,
          })

        await ctx.reply(
          `Hola @${username}! Para vincular tu cuenta de Telegram con la plataforma, ` +
          `ingresá a community-platform-app.vercel.app/dashboard/configuracion ` +
          `y pegá tu ID de Telegram: \`${telegramUserId}\``,
          { parse_mode: 'Markdown' }
        )
      } catch (err) {
        this.logger.warn(`Error en comando /vincular: ${err}`)
      }
    })

    this.bot.catch((err: any) => {
      this.logger.error(`Telegraf error: ${err}`)
    })
  }

  getBotInfo() {
    return this.bot?.telegram.getMe()
  }
}
