import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Redis } from '@upstash/redis'

@Injectable()
export class RedisService implements OnModuleInit {
  private client: Redis

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const url   = this.config.get<string>('UPSTASH_REDIS_REST_URL')
    const token = this.config.get<string>('UPSTASH_REDIS_REST_TOKEN')

    if (!url || !token) {
      throw new Error('Faltan UPSTASH_REDIS_REST_URL o UPSTASH_REDIS_REST_TOKEN en el .env')
    }

    this.client = new Redis({ url, token })
    console.log('✓ Upstash Redis conectado')
  }

  // ── Helpers tipados ────────────────────────────────────

  async get(key: string): Promise<string | null> {
    const val = await this.client.get<string>(key)
    return val ?? null
  }

  async set(key: string, value: string, exSeconds?: number): Promise<void> {
    if (exSeconds) {
      await this.client.setex(key, exSeconds, value)
    } else {
      await this.client.set(key, value)
    }
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key)
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds)
  }

  async del(key: string): Promise<void> {
    await this.client.del(key)
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key)
    return result === 1
  }

  // Para leaderboard con sorted sets
  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.client.zadd(key, { score, member })
  }

  async zincrby(key: string, increment: number, member: string): Promise<number> {
    const result = await this.client.zincrby(key, increment, member)
    return Number(result)
  }

  async zrevrank(key: string, member: string): Promise<number | null> {
    return this.client.zrevrank(key, member)
  }
}
