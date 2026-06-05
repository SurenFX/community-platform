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

  // voiceJoinedAt: discordId → timestamp de cuando entró al canal de voz
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
      this.logger.warn('DISCORD_BOT_TOKEN no configurado — bot desactivado')
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
    this.logger.log('✓ Discord bot conectado')
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

      // Verificar badge de antigüedad (solo si el miembro tiene joinedAt)
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

        // XP para el autor del mensaje (reacción recibida)
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

        // XP para quien reaccionó (reacción dada)
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

    // ── Nuevo miembro se une al servidor ─────────────────────────────────────
    this.client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
      if (member.user.bot) return

      const configuredGuildId = this.config.get<string>('DISCORD_GUILD_ID')
      if (configuredGuildId && member.guild.id !== configuredGuildId) return

      // Verificar que no hayamos recompensado este join antes (lifetime)
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

      this.logger.log(`👋 Nuevo miembro: ${member.user.tag}`)
    })

    // ── Tiempo en canal de voz ────────────────────────────────────────────────
    this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
      const member = newState.member ?? oldState.member
      if (!member || member.user.bot) return

      const discordId = member.user.id

      // Entró a un canal de voz
      if (!oldState.channelId && newState.channelId) {
        this.voiceJoinedAt.set(discordId, Date.now())
        return
      }

      // Salió de un canal de voz (o fue movido fuera)
      if (oldState.channelId && !newState.channelId) {
        const joinedAt = this.voiceJoinedAt.get(discordId)
        this.voiceJoinedAt.delete(discordId)
        if (!joinedAt) return

        const minutes = Math.floor((Date.now() - joinedAt) / 60000)
        const blocks  = Math.floor(minutes / 10)   // 1 evento cada 10 minutos
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

        this.logger.log(`🎙️ Voice time: ${member.user.tag} — ${minutes} min → ${blocks} bloques XP`)
      }
    })
  }

  // ── Badge de antigüedad en el servidor ────────────────────────────────────
  private readonly SENIORITY_BADGES = [
    { slug: 'seniority_founder',     months: 24 },
    { slug: 'seniority_veteran',     months: 12 },
    { slug: 'seniority_old',         months: 6  },
    { slug: 'seniority_established', months: 3  },
  ]

  private async checkSeniorityBadge(discordId: string, joinedAt: Date | null): Promise<void> {
    if (!joinedAt) return
    try {
      // Buscar el perfil
      const { data: profile } = await this.supabase.db
        .from('profiles')
        .select('id')
        .eq('discord_id', discordId)
        .single()
      if (!profile) return

      // Verificar si ya tiene algún badge de antigüedad
      const { data: existing } = await this.supabase.db
        .from('user_badges')
        .select('badges!inner(slug)')
        .eq('user_id', profile.id)
        .in('badges.slug', this.SENIORITY_BADGES.map(b => b.slug))

      if (existing && existing.length > 0) return

      // Calcular meses en el servidor
      const monthsInServer = Math.floor((Date.now() - joinedAt.getTime()) / (30 * 24 * 60 * 60 * 1000))

      // Encontrar el badge correspondiente
      const targetBadge = this.SENIORITY_BADGES.find(b => monthsInServer >= b.months)
      if (!targetBadge) return

      // Obtener ID del badge
      const { data: badge } = await this.supabase.db
        .from('badges')
        .select('id')
        .eq('slug', targetBadge.slug)
        .single()
      if (!badge) return

      // Otorgar badge
      const { error } = await this.supabase.db
        .from('user_badges')
        .insert({ user_id: profile.id, badge_id: badge.id })

      if (!error) {
        this.eventEmitter.emit('badge.earned', { userId: profile.id, badges: [targetBadge.slug] })
        this.logger.log(`🏛️ Seniority badge "${targetBadge.slug}" → user=${profile.id} (${monthsInServer} meses)`)
      }
    } catch (err) {
      this.logger.warn(`checkSeniorityBadge error: ${err}`)
    }
  }

  // ── Anuncios públicos ─────────────────────────────────────

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

  @OnEvent('user.level_up')
  async handleLevelUp(payload: {
    userId: string; discordId: string; oldLevel: number; newLevel: number
  }) {
    this.logger.log(`Level up: ${payload.discordId} ${payload.oldLevel}→${payload.newLevel}`)
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
