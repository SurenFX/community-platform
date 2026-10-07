const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { PGlite } = require('@electric-sql/pglite')

test('sorteos: dueño, participantes y transición atómica', async t => {
  const db = new PGlite()
  const alice='00000000-0000-0000-0000-000000000001', bob='00000000-0000-0000-0000-000000000002'
  const open=async(owner=alice,platform='KICK',keyword='!prueba') => (await db.query('SELECT * FROM st_open_raffle($1,$2,$3)',[owner,platform,keyword])).rows
  const enter=async(owner,platform,username,content) => (await db.query('SELECT st_enter_raffle($1,$2,$3,$4) AS entered',[owner,platform,username,content])).rows[0].entered
  const draw=async(owner,id) => (await db.query('SELECT * FROM st_draw_raffle($1,$2)',[owner,id])).rows
  let raffleId
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE st_streamers(id UUID PRIMARY KEY,is_active BOOLEAN DEFAULT true,kick_user_id TEXT,twitch_user_id TEXT);
      CREATE TABLE st_raffles(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),streamer_id UUID REFERENCES st_streamers,
        platform TEXT,keyword TEXT,status TEXT DEFAULT 'active',winner TEXT,created_at TIMESTAMPTZ DEFAULT now(),closed_at TIMESTAMPTZ);
      CREATE TABLE st_raffle_entries(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),raffle_id UUID REFERENCES st_raffles,
        username TEXT,UNIQUE(raffle_id,username));
      INSERT INTO st_streamers(id,kick_user_id) VALUES('${alice}','11'),('${bob}','22');`)
    const migration=fs.readFileSync(path.join(__dirname,'../../supabase/migrations/026_streamea_raffle_integrity.sql'),'utf8')
    await db.exec(migration);await db.exec(migration)
    await t.test('rechaza palabras inválidas y plataformas no conectadas',async()=>{
      assert.deepEqual(await open(alice,'TWITCH'),[])
      assert.deepEqual(await open(alice,'KICK','dos palabras'),[])
      assert.deepEqual(await open(alice,'OTRA'),[])
    })
    await t.test('20 aperturas simultáneas crean un solo sorteo',async()=>{
      const results=(await Promise.all(Array.from({length:20},()=>open()))).flat()
      assert.equal(results.length,1);raffleId=results[0].id
      assert.equal((await db.query("SELECT id FROM st_raffles WHERE status='active'")).rows.length,1)
    })
    await t.test('participa una vez, respeta canal/plataforma y normaliza mayúsculas',async()=>{
      assert.equal(await enter(alice,'KICK','Viewer','!PRUEBA'),true)
      assert.equal(await enter(alice,'KICK','viewer','!prueba'),false)
      assert.equal(await enter(bob,'KICK','ajeno','!prueba'),false)
      assert.equal(await enter(alice,'TWITCH','otro','!prueba'),false)
      assert.equal(await enter(alice,'KICK','otro','!distinto'),false)
    })
    await t.test('un dueño ajeno no puede elegir ni consultar un ganador',async()=>{
      assert.deepEqual(await draw(bob,raffleId),[])
      assert.equal((await db.query('SELECT status FROM st_raffles WHERE id=$1',[raffleId])).rows[0].status,'active')
    })
    await t.test('20 elecciones simultáneas producen un único resultado persistido',async()=>{
      const results=(await Promise.all(Array.from({length:20},()=>draw(alice,raffleId)))).flat()
      assert.deepEqual(results,[{winner:'viewer',platform:'KICK'}])
      assert.deepEqual((await db.query('SELECT status,winner FROM st_raffles WHERE id=$1',[raffleId])).rows,[{status:'drawn',winner:'viewer'}])
      assert.equal(await enter(alice,'KICK','tarde','!prueba'),false)
      assert.deepEqual(await draw(alice,raffleId),[])
    })
    await t.test('sin participantes no se cierra ni se inventa un ganador',async()=>{
      const id=(await open(bob))[0].id
      assert.deepEqual(await draw(bob,id),[])
      assert.equal((await db.query('SELECT status FROM st_raffles WHERE id=$1',[id])).rows[0].status,'active')
      await db.query("UPDATE st_raffles SET status='closed' WHERE id=$1",[id])
      assert.equal(await enter(bob,'KICK','tarde','!prueba'),false)
    })
    await t.test('anon y authenticated no pueden invocar operaciones privilegiadas',async()=>{
      for(const role of ['anon','authenticated']){
        await db.exec(`SET ROLE ${role}`)
        await assert.rejects(open(),/permission denied/)
        await assert.rejects(draw(alice,raffleId),/permission denied/)
        await assert.rejects(enter(alice,'KICK','viewer','!prueba'),/permission denied/)
        await db.exec('RESET ROLE')
      }
    })
    await t.test('la acción usa el dueño de sesión y anuncia solamente un resultado guardado',async()=>{
      const exports={},announcements=[]
      let result=[],seenOwner
      const server={auth:{getUser:async()=>({data:{user:{id:'session-owner'}}})},from(){const q={select(){return q},eq(){return q},async maybeSingle(){return {data:{id:alice,kick_user_id:'11'}}}};return q}}
      const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/app/panel/actions.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
      const deps={
        'next/cache':{revalidatePath(){}},'next/navigation':{redirect:url=>{throw new Error(url)}},
        '@/lib/supabase/server':{createSupabaseServer:async()=>server},
        '@/lib/supabase/admin':{createSupabaseAdmin:()=>({rpc:async(name,args)=>{assert.equal(name,'st_draw_raffle');seenOwner=args.p_streamer_id;return {data:result,error:null}}})},
        '@/lib/chat':{say:async(...args)=>{announcements.push(args);return true}},'@/lib/kick':{},'@/lib/twitch':{},
      }
      vm.runInNewContext(js,{exports,Date,String,Number,console,require:id=>deps[id]})
      const form=new FormData();form.set('raffleId',raffleId);form.set('streamerId',bob)
      await assert.rejects(exports.drawWinner(form),/result=unavailable/)
      assert.equal(announcements.length,0);assert.equal(seenOwner,alice)
      result=[{winner:'viewer',platform:'KICK'}]
      await assert.rejects(exports.drawWinner(form),/result=drawn/)
      assert.equal(announcements.length,1)
    })
  }finally{await db.close()}
})
