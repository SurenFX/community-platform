const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { PGlite } = require('@electric-sql/pglite')

test('avisos: pausa, límites, aislamiento y reservas simultáneas', async t => {
  const db = new PGlite()
  const alice = '00000000-0000-0000-0000-000000000001'
  const bob = '00000000-0000-0000-0000-000000000002'
  const claim = async (id = alice, platform = 'KICK') =>
    (await db.query('SELECT * FROM st_claim_announcement($1,$2)', [id, platform])).rows
  const age = () => db.exec("UPDATE st_announcements SET last_attempt_at = now() - interval '20 minutes'")
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL AS
      $$ SELECT nullif(current_setting('test.user_id',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE st_streamers(id UUID PRIMARY KEY, user_id UUID, is_active BOOLEAN DEFAULT true);
      GRANT SELECT ON st_streamers TO authenticated;
      INSERT INTO st_streamers(id,user_id) VALUES ('${alice}','${alice}'),('${bob}','${bob}');`)
    const migration = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/025_streamea_announcements.sql'), 'utf8')
    await db.exec(migration)
    await db.exec(migration)
    const twitchMigration = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261007225208_streamea_twitch_announcements.sql'), 'utf8')
    await db.exec(twitchMigration)
    await db.exec(twitchMigration)
    await db.query('INSERT INTO st_announcements(streamer_id,message) VALUES ($1,$2),($3,$4)', [alice,'Redes de Alice',bob,'Redes de Bob'])
    await t.test('nacen pausados y no se envían aunque venza el intervalo', async () => {
      await age(); assert.deepEqual(await claim(), [])
    })
    await t.test('requieren tiempo y cinco mensajes, y respetan el canal', async () => {
      await db.query('UPDATE st_announcements SET is_active=true, last_attempt_at=now() WHERE streamer_id=$1', [alice])
      for (let i=0;i<5;i++) assert.deepEqual(await claim(), [])
      assert.deepEqual(await claim(alice,'TWITCH'), [])
      await age()
      assert.equal((await claim())[0].message,'Redes de Alice')
      assert.deepEqual(await claim(bob), [])
    })
    await t.test('veinte eventos simultáneos reservan una sola publicación', async () => {
      await age()
      const rows = (await Promise.all(Array.from({length:20},()=>claim()))).flat()
      assert.equal(rows.length,1)
    })
    await t.test('dos avisos vencidos se separan al menos un minuto', async () => {
      await db.query('INSERT INTO st_announcements(streamer_id,message,is_active,message_count,last_attempt_at) VALUES ($1,$2,true,5,now()-interval \'20 minutes\')',[alice,'Segundo aviso'])
      assert.deepEqual(await claim(), [])
      await age()
      assert.equal((await claim()).length,1)
      assert.deepEqual(await claim(), [])
    })
    await t.test('Twitch tiene actividad y reservas separadas de Kick', async () => {
      await db.query("INSERT INTO st_announcements(streamer_id,platform,message,is_active,last_attempt_at) VALUES ($1,'TWITCH','Aviso Twitch',true,now()-interval '20 minutes')", [alice])
      await age()
      for (let i=0;i<8;i++) await claim()
      assert.equal((await db.query("SELECT message_count FROM st_announcements WHERE platform='TWITCH'")).rows[0].message_count,0)
      for (let i=0;i<4;i++) assert.deepEqual(await claim(alice,'TWITCH'), [])
      assert.equal((await claim(alice,'TWITCH'))[0].message,'Aviso Twitch')
      assert.deepEqual(await claim(alice,'TWITCH'), [])
      assert.deepEqual(await claim(alice,'DISCORD'), [])
    })
    await t.test('pausar o desactivar el streamer impide nuevos envíos', async () => {
      await age(); await db.exec('UPDATE st_announcements SET is_active=false')
      assert.deepEqual(await claim(), [])
      await db.exec('UPDATE st_announcements SET is_active=true,message_count=5; UPDATE st_streamers SET is_active=false')
      assert.deepEqual(await claim(), [])
    })
    await t.test('restricciones impiden intervalos cortos y textos vacíos', async () => {
      await assert.rejects(db.query('INSERT INTO st_announcements(streamer_id,message,interval_minutes) VALUES ($1,$2,1)',[alice,'aviso']), /check constraint/)
      await assert.rejects(db.query('INSERT INTO st_announcements(streamer_id,message) VALUES ($1,$2)',[alice,'  ']), /check constraint/)
    })
    await t.test('RLS aísla los avisos y solo service_role puede reservar', async () => {
      await db.exec(`SET test.user_id='${alice}'; SET ROLE authenticated`)
      assert.ok((await db.query('SELECT streamer_id FROM st_announcements')).rows.every(r=>r.streamer_id===alice))
      assert.equal((await db.query('UPDATE st_announcements SET message=$1 WHERE streamer_id=$2 RETURNING id',['ajeno',bob])).rows.length,0)
      await assert.rejects(claim(bob), /permission denied/)
      await assert.rejects(db.query('INSERT INTO st_announcements(streamer_id,message) VALUES ($1,$2)',[bob,'ajeno']), /row-level security/)
      await db.exec('RESET ROLE; SET ROLE anon')
      await assert.rejects(claim(), /permission denied/)
      await db.exec('RESET ROLE')
    })
  } finally { await db.close() }
})

test('avisos: fallos de reserva o pausa no envían; solo confirma envíos exitosos', async () => {
  let rpcError=false, enabled=true, sendOk=true, sent=0, confirmed=0, twitchSent=0, platform
  const admin={ async rpc(name,args){platform=args.p_platform;return {error:rpcError?{message:'fallo'}:null,data:[{id:'notice',message:'redes'}]}},
    from(){ const query={ select(){return query},eq(){return query},async maybeSingle(){return {data:{is_active:enabled}}},
      update(){confirmed++;return query},then(resolve){return Promise.resolve({error:null}).then(resolve)} };return query } }
  const exports={}
  const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/announcements.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
  vm.runInNewContext(js,{exports,Date,console:{warn(){}},require:id=> id==='./kick'?{sendKickChat:async()=>{sent++;return sendOk}}:id==='./twitch'?{sendTwitchChat:async()=>{twitchSent++;return sendOk}}:{createSupabaseAdmin:()=>admin}})
  rpcError=true;await exports.handleAnnouncement('alice','11');assert.equal(sent,0)
  rpcError=false;enabled=false;await exports.handleAnnouncement('alice','11');assert.equal(sent,0)
  enabled=true;sendOk=false;await exports.handleAnnouncement('alice','11');assert.equal(confirmed,0)
  sendOk=true;await exports.handleAnnouncement('alice','11');assert.equal(confirmed,1)
  const kickSent=sent
  await exports.handleAnnouncement('alice','22','TWITCH');assert.equal(platform,'TWITCH');assert.equal(twitchSent,1);assert.equal(sent,kickSent);assert.equal(confirmed,2)
  sendOk=false;await exports.handleAnnouncement('alice','22','TWITCH');assert.equal(confirmed,2)
})
