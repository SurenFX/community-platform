const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

test('Kick usa el token del canal y rechaza renovaciones fallidas', async () => {
  let expired = false, refreshOk = true, selected, sent = []
  const admin = { from(table) {
    assert.equal(table, 'st_streamers')
    return { select() { return this }, eq(key, value) { selected = value; return this },
      async maybeSingle() { return { data: { id: selected, kick_access_token: `token-${selected}`,
        kick_refresh_token: 'refresh', kick_expires_at: new Date(Date.now() + (expired ? -1000 : 3600000)).toISOString() } } },
      update() { return { async eq() { return { error: null } } } } }
  } }
  const exports = {}
  const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/kick.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(js, { exports, require: id => id === 'crypto' ? require('node:crypto') : { createSupabaseAdmin: () => admin },
    process: { env: {} }, Date, Number, Set, URLSearchParams, console: { warn() {}, error() {} },
    fetch: async (url, options) => {
      if (url.includes('/oauth/token')) return { ok: refreshOk, json: async () => ({ access_token: 'renewed', expires_in: 3600 }) }
      sent.push({ auth: options.headers.Authorization, body: JSON.parse(options.body) })
      return { ok: true, json: async () => ({ data: { is_sent: true } }) }
    } })
  assert.equal(await exports.sendKickChat('11', 'prueba'), true)
  assert.equal(await exports.sendKickChat('22', 'prueba'), true)
  assert.deepEqual(sent.map(s => s.auth), ['Bearer token-11', 'Bearer token-22'])
  assert.ok(sent.every(s => s.body.type === 'bot'))
  expired = true; refreshOk = false
  assert.equal(await exports.sendKickChat('11', 'prueba'), false)
  assert.equal(sent.length, 2)
  refreshOk = true
  assert.equal(await exports.sendKickChat('11', 'prueba'), true)
  assert.equal(sent[2].auth, 'Bearer renewed')
})
