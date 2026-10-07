const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load() {
  let row, requests = [], response = { ok: true, json: async () => ({ id: 'message' }) }
  const query = { select() { return query }, eq() { return query }, maybeSingle: async () => ({ data: row, error: null }) }
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/social-destinations.ts'),'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, Buffer, URL, AbortSignal, process: { env: { SUPABASE_SERVICE_ROLE_KEY: 'test-encryption-key-only' } },
      require: id => id === 'crypto' ? require('node:crypto') : id === 'server-only' ? {} : { createSupabaseAdmin: () => ({ from: () => query }) },
      fetch: async (url, options) => { requests.push({url,...options}); return response } })
  return { exports, requests, setRow: value => row = value, setResponse: value => response = value }
}
const discord = { platform: 'DISCORD', webhook: `https://discord.com/api/webhooks/123456789012345678/${'x'.repeat(40)}` }
const telegram = { platform: 'TELEGRAM', token: `123456789:${'a'.repeat(30)}`, chatId: '-100123456789' }

test('destinos: valida hosts, cifra y vincula credenciales al streamer y plataforma', () => {
  const { exports: api } = load()
  assert.equal(api.validateSocialConfig(discord), true); assert.equal(api.validateSocialConfig(telegram), true)
  for (const webhook of ['http://discord.com/api/webhooks/1/token','https://127.0.0.1/private',discord.webhook+'?extra=1','https://discord.com.attacker.example/api/webhooks/1/token']) {
    assert.equal(api.validateSocialConfig({platform:'DISCORD',webhook}), false)
  }
  const sealed = api.encryptSocialConfig('owner',discord)
  assert.equal(sealed.includes(discord.webhook), false)
  assert.equal(api.decryptSocialConfig('owner','DISCORD',sealed).webhook,discord.webhook)
  assert.throws(() => api.decryptSocialConfig('other','DISCORD',sealed))
  assert.throws(() => api.decryptSocialConfig('owner','TELEGRAM',sealed))
  assert.throws(() => api.decryptSocialConfig('owner','DISCORD','invalid'))
})

test('destinos: pausa, credenciales corruptas y respuestas rechazadas no confirman envíos', async () => {
  const state = load(), api = state.exports
  assert.equal(await api.sendSocialMessage('owner','DISCORD','hola'),false)
  state.setRow({is_active:false,encrypted_config:api.encryptSocialConfig('owner',discord)})
  assert.equal(await api.sendSocialMessage('owner','DISCORD','hola'),false);assert.equal(state.requests.length,0)
  state.setRow({is_active:true,encrypted_config:'invalid'})
  assert.equal(await api.sendSocialMessage('owner','DISCORD','hola'),false);assert.equal(state.requests.length,0)
  state.setRow({is_active:true,encrypted_config:api.encryptSocialConfig('owner',discord)})
  assert.equal(await api.sendSocialMessage('owner','DISCORD','hola @everyone'),true)
  assert.equal(state.requests[0].url,discord.webhook+'?wait=true')
  assert.deepEqual(JSON.parse(state.requests[0].body).allowed_mentions,{parse:[]})
  assert.equal(state.requests[0].redirect,'error')
  state.setResponse({ok:true,json:async()=>({})});assert.equal(await api.sendSocialMessage('owner','DISCORD','hola'),false)
  state.setResponse({ok:false});assert.equal(await api.sendSocialMessage('owner','DISCORD','hola'),false)
  state.setRow({is_active:true,encrypted_config:api.encryptSocialConfig('owner',telegram)})
  state.setResponse({ok:true,json:async()=>({ok:false})});assert.equal(await api.sendSocialMessage('owner','TELEGRAM','hola'),false)
  state.setResponse({ok:true,json:async()=>({ok:true,result:{message_id:123}})});assert.equal(await api.sendSocialMessage('owner','TELEGRAM','hola'),true)
  assert.equal(JSON.parse(state.requests.at(-1).body).chat_id,telegram.chatId)
})
