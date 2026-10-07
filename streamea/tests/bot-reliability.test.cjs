const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { PGlite } = require('@electric-sql/pglite')

// Ejecutamos el código TypeScript real, sustituyendo solo las APIs externas.
function load(name, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', name), 'utf8')
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const exports = {}
  vm.runInNewContext(js, {
    exports, require: id => {
      if (!(id in dependencies)) throw new Error(`Dependencia no simulada: ${id}`)
      return dependencies[id]
    }, console: { warn() {} }, Date, Number, Math, Set, Promise,
  })
  return exports
}

test('comandos: reservas SQL, eventos repetidos, aislamiento y fallos', async t => {
  const db = new PGlite()
  let sends = [], writes = 0, unavailable = false
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE st_streamers (id TEXT PRIMARY KEY);
      CREATE TABLE st_cooldowns (key TEXT PRIMARY KEY, used_at TIMESTAMPTZ NOT NULL);
    `)
    const migration = fs.readFileSync(path.join(__dirname,
      '../../supabase/migrations/024_streamea_bot_reliability.sql'), 'utf8')
    await db.exec(migration)
    await db.exec(migration) // La migración también admite volver a ejecutarse.

    const admin = {
      async rpc(name, args) {
        assert.equal(name, 'st_take_cooldown')
        if (unavailable) return { data: null, error: { message: 'DB no disponible' } }
        const result = await db.query('SELECT st_take_cooldown($1, $2) AS claimed',
          [args.p_key, args.p_seconds])
        return { data: result.rows[0].claimed, error: null }
      },
      from(table) {
        const query = {
          select() { return query }, eq() { return query },
          update(fields) {
            if (table === 'st_commands') writes++
            return query
          },
          async maybeSingle() {
            return { data: table === 'st_commands'
              ? { id: 'cmd', response: 'Hola', cooldown_seconds: 30, uses: 0 }
              : null, error: null }
          },
          then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject) },
        }
        return query
      },
    }
    const cooldown = load('cooldown.ts', { './supabase/admin': { createSupabaseAdmin: () => admin } })
    const chat = load('chat.ts', {
      './supabase/admin': { createSupabaseAdmin: () => admin },
      './cooldown': cooldown,
      './announcements': { handleAnnouncement: async () => {} },
      './kick': { sendKickChat: async (id, msg) => { sends.push(['KICK', id, msg]); return true } },
      './twitch': { sendTwitchChat: async (id, msg) => { sends.push(['TWITCH', id, msg]); return true } },
    })
    const message = { platform: 'KICK', tenant: { id: 'alice', broadcasterId: '1' },
      messageId: 'original', username: 'viewer', content: '!hola', isMod: false }

    await t.test('20 eventos simultáneos del mismo comando producen una respuesta', async () => {
      await Promise.all(Array.from({ length: 20 }, (_, i) =>
        chat.handleChatMessage({ ...message, messageId: `parallel-${i}` })))
      assert.equal(sends.length, 1)
      assert.equal(writes, 1)
    })
    await t.test('la reserva se libera al vencer el cooldown', async () => {
      await db.exec("UPDATE st_cooldowns SET used_at = now() - interval '31 seconds' WHERE key = 'alice:KICK:!hola'")
      await chat.handleChatMessage(message)
      assert.equal(sends.length, 2)
    })
    await t.test('una entrega repetida no responde aunque el comando vuelva a estar disponible', async () => {
      await db.exec("UPDATE st_cooldowns SET used_at = now() - interval '31 seconds' WHERE key = 'alice:KICK:!hola'")
      await chat.handleChatMessage(message)
      assert.equal(sends.length, 2)
    })
    await t.test('otros streamers y plataformas conservan sus propios turnos', async () => {
      await chat.handleChatMessage({ ...message, tenant: { id: 'bob', broadcasterId: '2' } })
      await chat.handleChatMessage({ ...message, platform: 'TWITCH' })
      assert.equal(sends.length, 4)
      assert.equal(sends[2][1], '2')
      assert.equal(sends[3][0], 'TWITCH')
    })
    await t.test('si falla la DB el bot no envía sin protección', async () => {
      unavailable = true
      await chat.handleChatMessage({ ...message, messageId: 'database-down' })
      assert.equal(sends.length, 4)
      unavailable = false
    })
    await t.test('anon y authenticated no pueden reservar turnos', async () => {
      for (const role of ['anon', 'authenticated']) {
        await db.exec(`SET ROLE ${role}`)
        await assert.rejects(db.query("SELECT st_take_cooldown('forbidden', 30)"), /permission denied/)
        await db.exec('RESET ROLE')
      }
    })
    await t.test('los recibos viejos se limpian sin borrar cooldowns de comandos', async () => {
      await db.exec("INSERT INTO st_cooldowns VALUES ('event:expired', now() - interval '3 days'), ('old-command', now() - interval '3 days')")
      await cooldown.takeCooldown('cleanup-trigger', 30)
      const result = await db.query("SELECT key FROM st_cooldowns WHERE key IN ('event:expired', 'old-command')")
      assert.deepEqual(result.rows, [{ key: 'old-command' }])
    })
    await t.test('rechaza eventos viejos, inválidos y del futuro', () => {
      const now = Date.now()
      assert.equal(cooldown.isFreshEvent(new Date(now).toISOString(), now), true)
      assert.equal(cooldown.isFreshEvent(new Date(now - 600001).toISOString(), now), false)
      assert.equal(cooldown.isFreshEvent(new Date(now + 60001).toISOString(), now), false)
      assert.equal(cooldown.isFreshEvent('', now), false)
    })
  } finally { await db.close() }
})
