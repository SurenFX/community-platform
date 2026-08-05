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

  private async isGroupAdmin(telegramUserId: string): Promise<boolean> {
    const groupId = this.config.get<string>('TELEGRAM_GROUP_ID')
    if (!this.bot || !groupId) return false
    try {
      const member = await this.bot.telegram.getChatMember(groupId, Number(telegramUserId))
      return member.status === 'administrator' || member.status === 'creator'
    } catch (err) {
      this.logger.warn(`Error verificando admin: ${err}`)
      return false
    }
  }

  private registerListeners() {
    if (!this.bot) return

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

    this.bot.command('recordatorio', async (ctx: Context) => {
      const msg = ctx.message as any
      if (!msg) return

      const senderId = String(msg.from?.id)

      if (!await this.isGroupAdmin(senderId)) {
        await ctx.reply('No podes usar este comando.')
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

      const channel = this.config.get<string>('TWITCH_CHANNEL') ?? 'SalchiNFT'
      await ctx.reply(`Escribiste un recordatorio para el proximo stream de @${channel}:\n\n"${reminder}"\n\nSe enviara automaticamente al chat de Twitch cuando empiece.`)
      this.logger.log(`Recordatorio guardado por telegram_id=${senderId}: "${reminder}"`)
    })

    // Alias de tema -> env var con el message_thread_id.
    // Agregar aca los que quieras nombrar. El resto se puede pasar por id numerico.
    const threadAliases: Record<string, string | undefined> = {
      reclutamiento: this.config.get<string>('TELEGRAM_RECRUITMENT_THREAD_ID'),
      youtube:       this.config.get<string>('TELEGRAM_YOUTUBE_THREAD_ID'),
      digest:        this.config.get<string>('TELEGRAM_DIGEST_THREAD_ID'),
    }

    this.bot.command('canales', async (ctx: Context) => {
      const senderId = String((ctx.message as any)?.from?.id)
      if (!await this.isGroupAdmin(senderId)) {
        await ctx.reply('No podes usar este comando.')
        return
      }
      const nombrados = Object.entries(threadAliases)
        .filter(([, v]) => v)
        .map(([k, v]) => `  #${k}  (tema ${v})`)
        .join('\n') || '  (ninguno configurado)'
      await ctx.reply(
        `Como elegir el subcanal con /decir:\n\n` +
        `  /decir <mensaje>              -> tema General\n` +
        `  /decir #<alias> <mensaje>     -> tema con nombre\n` +
        `  /decir #<numero> <mensaje>    -> tema por id\n\n` +
        `Alias disponibles:\n${nombrados}\n\n` +
        `Para un tema sin alias: abri el tema en Telegram, copia el link de ` +
        `cualquier mensaje (t.me/c/<grupo>/<numero>/...) y usa ese <numero> como id.`
      )
    })

    this.bot.command('decir', async (ctx: Context) => {
      const msg = ctx.message as any
      if (!msg) return

      const senderId = String(msg.from?.id)

      if (!await this.isGroupAdmin(senderId)) {
        await ctx.reply('No podes usar este comando.')
        return
      }

      const groupId = this.config.get<string>('TELEGRAM_GROUP_ID')
      if (!groupId) {
        await ctx.reply('No hay grupo configurado (TELEGRAM_GROUP_ID).')
        return
      }

      // Se toma msg.text crudo (no lowercased) para preservar mayusculas/tildes.
      const text = msg.text ?? ''
      const rest = text.replace(/^\/decir(@\w+)?\s*/i, '').trim()

      if (!rest) {
        await ctx.reply(
          'Uso: /decir <mensaje>  (tema General)\n' +
          '     /decir #<alias|id> <mensaje>  (subcanal especifico)\n\n' +
          'Ejemplo: /decir #reclutamiento Se abrieron cupos nuevos!\n' +
          'Mira /canales para ver los subcanales disponibles.'
        )
        return
      }

      // Destino opcional: primer token con prefijo '#'. Si no, va a General.
      let threadId: string | undefined
      let mensaje = rest

      const targetMatch = rest.match(/^#(\S+)\s+([\s\S]+)$/)
      if (targetMatch) {
        const target = targetMatch[1]
        mensaje      = targetMatch[2].trim()
        const key    = target.toLowerCase()

        if (key === 'general') {
          threadId = undefined
        } else if (/^\d+$/.test(target)) {
          threadId = target
        } else if (threadAliases[key]) {
          threadId = threadAliases[key]
        } else {
          await ctx.reply(`No conozco el subcanal "#${target}". Mira /canales o usa el id numerico del tema.`)
          return
        }
      }

      if (!mensaje) {
        await ctx.reply('Falta el mensaje. Uso: /decir #<alias|id> <mensaje>')
        return
      }

      try {
        await this.bot!.telegram.sendMessage(groupId, mensaje, {
          ...(threadId ? { message_thread_id: Number(threadId) } : {}),
        })
        await ctx.reply(threadId ? `Enviado al subcanal (tema ${threadId}).` : 'Enviado al tema General.')
        this.logger.log(`/decir por telegram_id=${senderId} tema=${threadId ?? 'general'}: "${mensaje.slice(0, 80)}"`)
      } catch (err) {
        this.logger.error(`Error en /decir: ${err}`)
        await ctx.reply('Error al enviar el mensaje. Revisa que el id del tema sea correcto.')
      }
    })

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

  async sendReplaceable(
    chatId: string,
    text: string,
    threadId?: string | null,
    previousMessageId?: string | null,
  ): Promise<string | null> {
    if (!this.bot || !chatId) return null

    if (previousMessageId) {
      try {
        await this.bot.telegram.deleteMessage(chatId, Number(previousMessageId))
      } catch {
        // el mensaje ya no existe o no se pudo borrar
      }
    }

    try {
      const sent = await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        ...(threadId ? { message_thread_id: Number(threadId) } : {}),
      })
      this.logger.log(`Telegram anuncio (replaceable) enviado${threadId ? ` al tema #${threadId}` : ''}`)
      return String(sent.message_id)
    } catch (err) {
      this.logger.warn(`Error en sendReplaceable Telegram: ${err}`)
      return null
    }
  }

  getBotInfo() {
    return this.bot?.telegram.getMe()
  }
}
