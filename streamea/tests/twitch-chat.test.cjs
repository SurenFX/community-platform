const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function sender(response) {
  const query = {
    select() { return query }, eq() { return query },
    async maybeSingle() { return { data: {
      access_token: 'test-token', bot_user_id: 'bot', bot_username: 'test-bot',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    } } },
  }
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/twitch.ts'), 'utf8')
  const exports = {}
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    exports, require: name => name === 'crypto' ? require('node:crypto') : {
      createSupabaseAdmin: () => ({ from: () => query }),
    },
    process: { env: { TWITCH_CLIENT_ID: 'test-client' } },
    console: { warn() {}, error() {} }, Date, Buffer, URLSearchParams,
    fetch: async (url, options) => {
      assert.equal(url, 'https://api.twitch.tv/helix/chat/messages')
      assert.equal(JSON.parse(options.body).broadcaster_id, 'channel')
      return response
    },
  })
  return exports.sendTwitchChat
}

test('Twitch solo confirma mensajes que la API marcó como enviados', async () => {
  assert.equal(await sender({ ok: true, json: async () => ({ data: [{ is_sent: true }] }) })('channel', 'hola'), true)
  assert.equal(await sender({ ok: true, json: async () => ({ data: [{ is_sent: false, drop_reason: { code: 'automod_held' } }] }) })('channel', 'hola'), false)
  assert.equal(await sender({ ok: true, json: async () => ({ data: [] }) })('channel', 'hola'), false)
  assert.equal(await sender({ ok: true, json: async () => { throw new Error('invalid JSON') } })('channel', 'hola'), false)
  assert.equal(await sender({ ok: false, status: 403, text: async () => 'Forbidden' })('channel', 'hola'), false)
})
