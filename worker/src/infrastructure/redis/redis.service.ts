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
      throw new Error('Faltan UPSTASH_REDIS_REST_URL o UPSTASH_REDIS_REST_TOKEN')
    }

    this.client = new Redis({ url, token })
    console.log('✓ Upstash Redis conectado')
  }

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

  /**
   * SET NX EX — atómico
   * Retorna true si obtuvo el lock, false si ya existía
   * Úsalo para distributed locks entre múltiples instancias
   */
  async setNX(key: string, value: string, exSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, {
      nx: true,   // solo setear si NO existe
      ex: exSeconds,
    })
    return result === 'OK'
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
