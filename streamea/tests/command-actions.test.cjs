const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

test('panel comandos: valida, edita, pausa y aísla al dueño de sesión', async t => {
  let databaseError = false, loggedIn = true
  const records = [{ id: 'foreign', streamer_id: 'other', command: '!foreign', response: 'ajeno', is_active: true }]
  const server = { auth: { getUser: async () => ({ data: { user: loggedIn ? { id: 'user' } : null } }) },
    from: () => { const query = { select() { return query }, eq() { return query },
      maybeSingle: async () => ({ data: { id: 'owner', kick_user_id: 'channel' } }) }; return query } }
  const admin = { from: table => {
    assert.equal(table, 'st_commands')
    const filters = []
    let update, deleting = false
    const execute = async () => {
      if (databaseError) return { error: { message: 'db unavailable' }, data: null }
      const row = records.find(row => filters.every(([key,value]) => row[key] === value))
      if (!row) return { data: null, error: null }
      if (update) Object.assign(row, update)
      if (deleting) records.splice(records.indexOf(row), 1)
      return { data: { id: row.id }, error: null }
    }
    const query = { eq(key,value) { filters.push([key,value]); return query }, select() { return query },
      update(fields) { update = fields; return query }, delete() { deleting = true; return query },
      maybeSingle: execute,
      async upsert(fields) {
        if (databaseError) return { error: { message: 'db unavailable' } }
        const found = records.find(row => row.streamer_id === fields.streamer_id && row.command === fields.command)
        if (found) Object.assign(found, fields)
        else records.push({ id: 'owned', is_active: true, ...fields })
        return { error: null }
      } }; return query
  } }
  const dependencies = {
    'next/cache': { revalidatePath() {} }, 'next/navigation': { redirect: url => { throw new Error(url) } },
    '@/lib/supabase/server': { createSupabaseServer: async () => server },
    '@/lib/supabase/admin': { createSupabaseAdmin: () => admin },
    '@/lib/chat': {}, '@/lib/kick': {}, '@/lib/twitch': {},
  }
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/panel/actions.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, require: id => dependencies[id], Date, Number, String, console })
  const form = fields => ({ get: key => fields[key] ?? null })
  const run = (fn, fields, result) => assert.rejects(exports[fn](form(fields)), new RegExp(`result=${result}`))
  await t.test('normaliza el comando y usa el dueño de sesión, ignorando un dueño inyectado', async () => {
    await run('saveCommand', { command: 'REDES', response: 'redes', cooldown_seconds: '30', streamer_id: 'other' }, 'saved')
    assert.equal(records[1].command, '!redes'); assert.equal(records[1].streamer_id, 'owner')
  })
  await t.test('pausa y edita sin activar otra vez ni duplicar filas', async () => {
    await run('toggleCommand', { id: 'owned', enable: 'false' }, 'updated')
    await run('saveCommand', { command: '!redes', response: 'respuesta nueva', cooldown_seconds: '60' }, 'saved')
    assert.equal(records.length, 2); assert.equal(records[1].is_active, false); assert.equal(records[1].response, 'respuesta nueva')
  })
  await t.test('no altera ni elimina comandos ajenos', async () => {
    await run('toggleCommand', { id: 'foreign', enable: 'false' }, 'failed')
    await run('deleteCommand', { id: 'foreign' }, 'failed')
    assert.equal(records[0].is_active, true); assert.equal(records.length, 2)
  })
  await t.test('rechaza espacios, comandos reservados, límites inválidos y respuestas largas', async () => {
    for (const command of ['!dos palabras', '!addcom', '!delcom', '!'+ 'x'.repeat(30)]) await run('saveCommand', { command, response: 'ok' }, 'invalid')
    await run('saveCommand', { command: '!test', response: 'x'.repeat(481) }, 'invalid')
    await run('saveCommand', { command: '!test', response: 'ok', cooldown_seconds: '0' }, 'invalid')
    assert.equal(records.length, 2)
  })
  await t.test('informa fallo de base de datos y exige sesión', async () => {
    databaseError = true
    await run('saveCommand', { command: '!test', response: 'ok' }, 'failed')
    loggedIn = false
    await assert.rejects(exports.toggleCommand(form({ id: 'owned', enable: 'true' })), /No hay sesión/)
  })
})
