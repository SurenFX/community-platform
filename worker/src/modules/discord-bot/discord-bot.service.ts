import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter'
import { SupabaseService } from '../../infrastructure/supabase/supabase.service'
import {
  Client, GatewayIntentBits, Events,
  Message, MessageReaction, PartialMessageReaction,
  User, PartialUser, EmbedBuilder, TextChannel,
  GuildMember,
} from 'discord.js'
import { ReputationService } from '../reputation/reputation.service'
import { RedisService } from '../../infrastructure/redis/redis.service'

@Injectable()
export class DiscordBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordBotService.name)
  private client: Client

  private readonly voiceJoinedAt = new Map<string, number>()

  constructor(
    private config:       ConfigService,
    private reputation:   ReputationService,
    private eventEmitter: EventEmitter2,
    private supabase:     SupabaseService,
    private redis:        RedisService,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('DISCORD_BOT_TOKEN')
    if (!token) {
      this.logger.warn('DISCORD_BOT_TOKEN no configurado -- bot desactivado')
      return
    }
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
      ],
      partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
    } as any)
    this.registerListeners()
    await this.client.login(token)
    this.logger.log('Discord bot conectado')
  }

  async onModuleDestroy() {
    this.client?.destroy()
  }

  private registerListeners() {
    this.client.once(Events.ClientReady, (c) => {
      this.logger.log(`Bot listo: ${c.user.tag}`)
    })

    this.client.on(Events.MessageCreate, async (message: Message) => {
      if (message.author.bot) return
      if (!message.guild)     return

      const configuredGuildId = this.config.get<string>('DISCORD_GUILD_ID')
      if (configuredGuildId && message.guild.id !== configuredGuildId) return

      if (await this.checkSesameTrigger(message)) return

      const ignoredChannels = this.config.get<string>('IGNORED_CHANNELS')?.split(',') ?? []
      if (ignoredChannels.includes(message.channelId)) return

      await this.reputation.processXpEvent({
        discordId:   message.author.id,
        eventType:   'DISCORD_MESSAGE',
        platform:    'DISCORD',
        externalRef: message.id,
        metadata: {
          content:    message.content.slice(0, 500),
          channel_id: message.channelId,
          guild_id:   message.guild.id,
        },
      })

      this.checkSeniorityBadge(message.author.id, message.member?.joinedAt ?? null)
    })

    this.client.on(
      Events.MessageReactionAdd,
      async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        if (user.bot) return
        if (reaction.partial) {
          try { await reaction.fetch() } catch { return }
        }
        if (reaction.message.partial) {
          try { await reaction.message.fetch() } catch { return }
        }
        const author = reaction.message.author
        if (!author || author.bot)  return
        if (author.id === user.id)  return

        await this.reputation.processXpEvent({
          discordId:   author.id,
          eventType:   'DISCORD_REACTION_RECEIVED',
          platform:    'DISCORD',
          externalRef: reaction.message.id,
          metadata: {
            emoji:          reaction.emoji.name,
            reactor_id:     user.id,
            reaction_count: reaction.count ?? 1,
          },
        })

        await this.reputation.processXpEvent({
          discordId:   user.id,
          eventType:   'DISCORD_REACTION_GIVEN',
          platform:    'DISCORD',
          externalRef: `reaction_given_${user.id}_${reaction.message.id}`,
          metadata: {
            emoji:      reaction.emoji.name,
            message_id: reaction.message.id,
          },
        })
      }
    )

    this.client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
      if (member.user.bot) return

      const configuredGuildId = this.config.get<string>('DISCORD_GUILD_ID')
      if (configuredGuildId && member.guild.id !== configuredGuildId) return

      const dedupKey = `discord:join:${member.user.id}`
      const isFirst  = await this.redis.setNX(dedupKey, '1', 365 * 24 * 60 * 60)
      if (!isFirst) return

      await this.reputation.processXpEvent({
        discordId:   member.user.id,
        eventType:   'DISCORD_JOIN',
        platform:    'DISCORD',
        externalRef: `discord_join_${member.user.id}`,
        metadata:    { guild_id: member.guild.id },
      })

      this.logger.log(`Nuevo miembro: ${member.user.tag}`)
    })

    this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
      const member = newState.member ?? oldState.member
      if (!member || member.user.bot) return

      const discordId = member.user.id

      if (!oldState.channelId && newState.channelId) {
        this.voiceJoinedAt.set(discordId, Date.now())
        return
      }

      if (oldState.channelId && !newState.channelId) {
        const joinedAt = this.voiceJoinedAt.get(discordId)
        this.voiceJoinedAt.delete(discordId)
        if (!joinedAt) return

        const minutes = Math.floor((Date.now() - joinedAt) / 60000)
        const blocks  = Math.floor(minutes / 10)
        if (blocks < 1) return

        for (let i = 0; i < blocks; i++) {
          await this.reputation.processXpEvent({
            discordId,
            eventType:   'DISCORD_VOICE_TIME',
            platform:    'DISCORD',
            externalRef: `voice_${discordId}_${joinedAt}_block${i}`,
            metadata:    { minutes: 10, channel_id: oldState.channelId },
          })
        }

        this.logger.log(`Voice time: ${member.user.tag} -- ${minutes} min -> ${blocks} bloques XP`)
      }
    })
  }

  private readonly SENIORITY_BADGES = [
    { slug: 'seniority_founder',     months: 24 },
    { slug: 'seniority_veteran',     months: 12 },
    { slug: 'seniority_old',         months: 6  },
    { slug: 'seniority_established', months: 3  },
  ]

  private async checkSeniorityBadge(discordId: string, joinedAt: Date | null): Promise<void> {
    if (!joinedAt) return
    try {
      const { data: profile } = await this.supabase.db
        .from('profiles')
        .select('id')
        .eq('discord_id', discordId)
        .single()
      if (!profile) return

      const { data: existing } = await this.supabase.db
        .from('user_badges')
        .select('badges!inner(slug)')
        .eq('user_id', profile.id)
        .in('badges.slug', this.SENIORITY_BADGES.map(b => b.slug))

      if (existing && existing.length > 0) return

      const monthsInServer = Math.floor((Date.now() - joinedAt.getTime()) / (30 * 24 * 60 * 60 * 1000))

      const targetBadge = this.SENIORITY_BADGES.find(b => monthsInServer >= b.months)
      if (!targetBadge) return

      const { data: badge } = await this.supabase.db
        .from('badges')
        .select('id')
        .eq('slug', targetBadge.slug)
        .single()
      if (!badge) return

      const { error } = await this.supabase.db
        .from('user_badges')
        .insert({ user_id: profile.id, badge_id: badge.id })

      if (!error) {
        this.eventEmitter.emit('badge.earned', { userId: profile.id, badges: [targetBadge.slug] })
        this.logger.log(`Seniority badge "${targetBadge.slug}" -> user=${profile.id} (${monthsInServer} meses)`)
      }
    } catch (err) {
      this.logger.warn(`checkSeniorityBadge error: ${err}`)
    }
  }

  private async checkSesameTrigger(message: Message): Promise<boolean> {
    const triggerChannelId = this.config.get<string>('DISCORD_SESAME_TRIGGER_CHANNEL_ID')
    const targetChannelId  = this.config.get<string>('DISCORD_SESAME_TARGET_CHANNEL_ID')
    if (!triggerChannelId || !targetChannelId) return false
    if (message.channelId !== triggerChannelId) return false

    const normalized = message.content
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')

    if (!normalized.includes('abrete sesamo')) return false

    try {
      const member = message.member ?? await message.guild?.members.fetch(message.author.id)

      if (!member?.voice?.channelId) {
        await message.reply('Tenes que estar conectado al canal de voz para usar "Abrete Sesamo".')
        return true
      }

      await member.voice.setChannel(targetChannelId)
      this.logger.log(`Abrete Sesamo: ${member.user.tag} movido al canal privado`)
    } catch (err) {
      this.logger.warn(`Error en Abrete Sesamo: ${err}`)
    }

    return true
  }

  async announce(channelId: string, embed: EmbedBuilder, content?: string): Promise<void> {
    if (!this.client?.isReady()) return
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !(channel instanceof TextChannel)) {
        this.logger.warn(`Canal ${channelId} no encontrado o no es de texto`)
        return
      }
      await channel.send({ content, embeds: [embed] })
    } catch (err) {
      this.logger.warn(`Error enviando anuncio a ${channelId}: ${err}`)
    }
  }

  async sendReplaceable(
    channelId: string,
    embed: EmbedBuilder,
    previousMessageId?: string | null,
  ): Promise<string | null> {
    if (!this.client?.isReady()) return null
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (!channel || !(channel instanceof TextChannel)) {
        this.logger.warn(`Canal ${channelId} no encontrado o no es de texto`)
        return null
      }

      if (previousMessageId) {
        try {
          const prevMsg = await channel.messages.fetch(previousMessageId)
          await prevMsg.delete()
        } catch {
          // el mensaje ya no existe o no se pudo borrar
        }
      }

      const sent = await channel.send({ embeds: [embed] })
      return sent.id
    } catch (err) {
      this.logger.warn(`Error en sendReplaceable a ${channelId}: ${err}`)
      return null
    }
  }

  @OnEvent('user.level_up')
  async handleLevelUp(payload: {
    userId: string; discordId: string; oldLevel: number; newLevel: number
  }) {
    this.logger.log(`Level up: ${payload.discordId} ${payload.oldLevel}->${payload.newLevel}`)
    const configuredGuildId = this.config.get<string>('DISCORD_GUILD_ID')
    if (!configuredGuildId || !this.client) return
    try {
      const guild  = await this.client.guilds.fetch(configuredGuildId)
      const member = await guild.members.fetch(payload.discordId)
      const ROLE_MAP = [
        { minLevel: 75, roleId: this.config.get('ROLE_LEGEND')  ?? '' },
        { minLevel: 50, roleId: this.config.get('ROLE_ELITE')   ?? '' },
        { minLevel: 25, roleId: this.config.get('ROLE_CORE')    ?? '' },
        { minLevel: 10, roleId: this.config.get('ROLE_REGULAR') ?? '' },
        { minLevel: 1,  roleId: this.config.get('ROLE_VIEWER')  ?? '' },
      ]
      const allRoleIds = ROLE_MAP.map(r => r.roleId).filter(Boolean)
      const targetRole = ROLE_MAP.find(r => payload.newLevel >= r.minLevel)
      if (!targetRole?.roleId) return
      for (const roleId of allRoleIds) {
        if (roleId !== targetRole.roleId && member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId).catch(() => {})
        }
      }
      if (!member.roles.cache.has(targetRole.roleId)) {
        await member.roles.add(targetRole.roleId)
      }
    } catch (err) {
      this.logger.warn(`Error sincronizando rol: ${err}`)
    }
  }
}
