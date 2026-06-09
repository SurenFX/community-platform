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
      this.logger.warn('TELEGRAM_BOT_TOKEN no configurado -- bot desactivado')
      return
    }

    this.bot = new Telegraf(token)
    this.registerListeners()

    this.bot.launch({
      allowedUpdates: [
        'message',
        'edited_message',
        'chat_member',
        'message_reaction',
        'callback_query',
        'my_chat_member',
      ],
    }).catch(err => {
      this.logger.error(`Error lanzando bot de Telegram: ${err}`)
    })

    this.logger.log('Telegram bot conectado')
  }

  async onModuleDestroy() {
    this.bot?.stop('SIGTERM')
  }

  private isAdmin(telegramUserId: string): boolean {
    const raw = this.config.get<string>('TELEGRAM_ADMIN_IDS') ?? ''
    const ids = raw.split(',').map(s => s.trim()).filter(Boolean)
    if (ids.length === 0) return true // si no hay lista configurada, permitir a todos
    return ids.includes(telegramUserId)
  }

  private registerListeners() {
    if (!this.bot) return

    // /start -- maneja deep links de vinculacion (/start TOKEN)
    this.bot.command('start', async (ctx: Context) => {
      const msg = ctx.message as any
      if (!msg) return

      const text  = msg.text ?? ''
      const parts = text.split(' ')
      const token = parts[1]?.trim()

      const telegramUserId = String(msg.from?.id)
      const username       = msg.from?.username ?? msg.from?.first_name ?? 'Usuario'

      if (!token) {
        await ctx.reply(
          `Hola @${username}! Usa el boton "Conectar Telegram" en la plataforma para vincular tu cuenta automaticamente.`
        )
        return
      }

      try {
        const { data: linkToken, error } = await this.supabase.db
          .from('telegram_link_tokens')
          .select('user_id, expires_at, used_at')
          .eq('token', token)
          .single()

        if (error || !linkToken) {
          await ctx.reply('El enlace es invalido o ya fue usado. Genera uno nuevo desde la plataforma.')
          return
        }

        if (linkToken.used_at) {
          await ctx.reply('Este enlace ya fue usado. Genera uno nuevo desde la plataforma.')
          return
        }

        if (new Date(linkToken.expires_at) < new Date()) {
          await ctx.reply('El enlace expiro. Genera uno nuevo desde la plataforma.')
          return
        }

        const { error: upsertError } = await this.supabase.db
          .from('user_social_links')
          .upsert({
            user_id:     linkToken.user_id,
            platform:    'TELEGRAM',
            external_id: telegramUserId,
            username:    username,
            is_verified: true,
          }, { onConflict: 'user_id,platform' })

        if (upsertError) throw upsertError

        await this.supabase.db
          .from('telegram_link_tokens')
          .update({ used_at: new Date().toISOString() })
          .eq('token', token)

        await ctx.reply(
          `Tu cuenta de Telegram fue vinculada exitosamente!\n\n` +
          `A partir de ahora ganas XP por cada mensaje que mandes en el grupo.`
        )

        this.logger.log(`Telegram vinculado: user_id=${linkToken.user_id} telegram_id=${telegramUserId} @${username}`)

      } catch (err) {
        this.logger.error(`Error en /start vinculacion: ${err}`)
        await ctx.reply('Ocurrio un error al vincular. Intenta de nuevo desde la plataforma.')
      }
    })

    // /recordatorio <mensaje> -- guarda un recordatorio para enviar al chat de Twitch cuando empieze el stream
    this.bot.command('recordatorio', async (ctx: Context) => {
      const msg = ctx.message as any
      if (!msg) return

      const senderId = String(msg.from?.id)

      if (!this.isAdmin(senderId)) {
        await ctx.reply('No tenes permiso para usar este comando.')
        return
      }

      const text     = msg.text ?? ''
      const reminder = text.replace(/^\/recordatorio\s*/i, '').trim()

      if (!reminder) {
        await ctx.reply('Uso: /recordatorio <mensaje>\nEjemplo: /recordatorio Hablar del torneo de esta noche!')
        return
      }

      const { error } = await this.supabase.db
        .from('stream_reminders')
        .insert({
          message:                reminder,
          created_by_telegram_id: senderId,
        })

      if (error) {
        this.logger.error(`Error guardando recordatorio: ${error.message}`)
        await ctx.reply('Error al guardar el recordatorio. Intenta de nuevo.')
        return
      }

      await ctx.reply(`Recordatorio guardado. Se enviara al chat de Twitch cuando empiece el stream:\n\n"${reminder}"`)
      this.logger.log(`Recordatorio guardado por telegram_id=${senderId}: "${reminder}"`)
    })

    // Escuchar mensajes de texto en grupos para dar XP
    this.bot.on('text', async (ctx: Context) => {
      try {
        const msg = ctx.message as any
        if (!msg) return

        const chatType = msg.chat?.type
        if (chatType !== 'group' && chatType !== 'supergroup') return

        const telegramUserId = String(msg.from?.id)
        const chatId         = String(msg.chat?.id)
        const messageId      = String(msg.message_id)
        const text           = msg.text ?? ''

        const configuredChatId = this.config.get<string>('TELEGRAM_GROUP_ID')
        if (configuredChatId && chatId !== configuredChatId) return

        if (!configuredChatId) {
          this.logger.log(`Mensaje en grupo ${chatId} de @${msg.from?.username} -- configura TELEGRAM_GROUP_ID=${chatId}`)
        }

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

    // Nuevo miembro se une al grupo
    this.bot.on('chat_member', async (ctx: Context) => {
      try {
        const update = (ctx as any).chatMember
        if (!update) return

        const newStatus = update.new_chat_member?.status
        const oldStatus = update.old_chat_member?.status

        if (newStatus !== 'member' && newStatus !== 'administrator') return
        if (oldStatus === 'member' || oldStatus === 'administrator') return

        const from = update.new_chat_member?.user
        if (!from || from.is_bot) return

        const telegramUserId   = String(from.id)
        const configuredChatId = this.config.get<string>('TELEGRAM_GROUP_ID')
        const chatId           = String(update.chat?.id)
        if (configuredChatId && chatId !== configuredChatId) return

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
          eventType:   'TELEGRAM_JOIN',
          platform:    'TELEGRAM',
          externalRef: `tg_join_${telegramUserId}`,
          metadata:    { telegram_user_id: telegramUserId, chat_id: chatId },
        })

        this.logger.log(`Nuevo miembro Telegram: @${from.username ?? from.first_name}`)

      } catch (err) {
        this.logger.warn(`Error procesando chat_member: ${err}`)
      }
    })

    // Reaccion a un mensaje
    this.bot.on('message_reaction', async (ctx: Context) => {
      try {
        const update = (ctx as any).messageReaction
        if (!update) return

        const from = update.user
        if (!from || from.is_bot) return

        const newReactions = update.new_reaction ?? []
        const oldReactions = update.old_reaction ?? []
        if (newReactions.length <= oldReactions.length) return

        const telegramUserId   = String(from.id)
        const configuredChatId = this.config.get<string>('TELEGRAM_GROUP_ID')
        const chatId           = String(update.chat?.id)
        if (configuredChatId && chatId !== configuredChatId) return

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
          eventType:   'TELEGRAM_REACTION',
          platform:    'TELEGRAM',
          externalRef: `tg_reaction_${telegramUserId}_${update.message_id}`,
          metadata:    { telegram_user_id: telegramUserId, message_id: String(update.message_id) },
        })

      } catch (err) {
        this.logger.warn(`Error procesando message_reaction: ${err}`)
      }
    })

    this.bot.catch((err: any) => {
      this.logger.error(`Telegraf error: ${err}`)
    })
  }

  // Enviar mensaje al grupo de Telegram (con soporte de subtema)
  async announce(text: string, threadEnvKey?: string): Promise<void> {
    const groupId  = this.config.get<string>('TELEGRAM_GROUP_ID')
    const threadId = threadEnvKey ? this.config.get<string>(threadEnvKey) : undefined
    if (!this.bot || !groupId) return
    try {
      await this.bot.telegram.sendMessage(groupId, text, {
        parse_mode: 'HTML',
        ...(threadId ? { message_thread_id: Number(threadId) } : {}),
      })
      this.logger.log(`Telegram anuncio enviado${threadId ? ` al tema #${threadId}` : ''}`)
    } catch (err) {
      this.logger.warn(`Error enviando anuncio Telegram: ${err}`)
    }
  }

  getBotInfo() {
    return this.bot?.telegram.getMe()
  }
}
