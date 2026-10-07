const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

test('Twitch no procesa sus propios mensajes ni envía si falla la identificación del bot', async () => {
  let handled = 0, dbError = false
  const query = { select() { return query }, eq() { return query }, async maybeSingle() {
    return { data: { bot_user_id: 'bot' }, error: dbError ? { message: 'unavailable' } : null }
  } }
  const dependencies = {
    'next/server': { NextResponse: class { constructor(body, opts) { this.status = opts.status } } },
    '@/lib/twitch': { verifyTwitchSignature: () => true },
    '@/lib/cooldown': { isFreshEvent: () => true },
    '@/lib/chat': { findTenant: async () => ({ id: 'owner' }), handleChatMessage: async () => { handled++ } },
    '@/lib/supabase/admin': { createSupabaseAdmin: () => ({ from: () => query }) },
  }
  const exports = {}
  const source = fs.readFileSync(path.join(__dirname, '../src/app/api/twitch/webhook/route.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require: id => dependencies[id], console: { error() {}, warn() {} } })
  const request = user => ({ headers: { get: name => name === 'twitch-eventsub-message-type' ? 'notification' : 'test' },
    text: async () => JSON.stringify({ subscription: { type: 'channel.chat.message' }, event: {
      broadcaster_user_id: 'channel', chatter_user_id: user, chatter_user_login: user, message: { text: 'hola' },
    } }) })
  assert.equal((await exports.POST(request('bot'))).status, 204)
  assert.equal(handled, 0)
  await exports.POST(request('viewer')); assert.equal(handled, 1)
  dbError = true
  await exports.POST(request('viewer')); assert.equal(handled, 1)
})
