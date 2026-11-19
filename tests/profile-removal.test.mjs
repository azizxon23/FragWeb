import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {readFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {build} from 'esbuild';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
test('private owner removal matches one profile and preserves administrator access',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fragweb-removal-'));
 await build({entryPoints:['tests/fixtures/api-worker.ts'],outfile:join(dir,'worker.mjs'),bundle:true,format:'esm',platform:'browser',external:['cloudflare:workers'],logLevel:'silent'});
 const mf=new Miniflare({modules:true,modulesRoot:dir,rootPath:dir,scriptPath:join(dir,'worker.mjs'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{FRAGWEB_PROFILE_REMOVAL_REQUEST:JSON.stringify({id:'00000000-0000-4000-8000-000000000123',createdAt:42,requestId:'00000000-0000-4000-8000-000000000456',expiresAt:Date.now()+600000})}});
 try{
 const db=await mf.getD1Database('DB');
 async function apply(file){for(const s of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').flatMap(s=>s.split(';')).map(s=>s.trim()).filter(Boolean))await db.prepare(s).run();}
 for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())await apply(f);
 const id='00000000-0000-4000-8000-000000000123';
 for(const [p,owner,date] of [[id,'target',42],['keep','other',1]])await db.prepare("INSERT INTO profiles(id,owner_id,display_name,email,phone,telegram,city,created_at,updated_at) VALUES(?,?,?,'','','','Tashkent',?,1)").bind(p,owner,owner,date).run();
 for(const owner of ['target','other']){
 await db.prepare("INSERT INTO listings(id,owner_id,seller,phone,telegram,city,brand,name,gender,size,remaining,price,condition,description,photos,created_at) VALUES(?,?,?,'','','Tashkent','Test','Test','men',100,80,100,'box','description','[]',1)").bind(owner+'-listing',owner,owner).run();
 await db.prepare('INSERT INTO marketplace_accounts(owner_id,email,password_hash,created_at) VALUES(?,?,?,1)').bind(owner,owner+'@example.test','verifier-'+owner).run();
 await db.prepare('INSERT INTO marketplace_sessions(token_hash,owner_id,expires_at) VALUES(?,?,9)').bind(owner,owner).run();
 await db.prepare("INSERT INTO listing_likes(id,listing_id,owner_id,created_at) VALUES(?,'target-listing',?,1)").bind(owner,owner).run();
 await db.prepare("INSERT INTO listing_comments(id,listing_id,owner_id,body,created_at) VALUES(?,'target-listing',?,'hello',1)").bind(owner,owner).run();
 }
 await db.prepare("INSERT INTO admin_accounts(email,password_hash,added_by,created_at) VALUES('owner@example.test','admin-verifier','owner',1)").run();
 await db.prepare("INSERT INTO admin_sessions(token_hash,owner_id,email,password_version,expires_at) VALUES('admin-token','target','owner@example.test','version',9)").run();
 assert.equal((await mf.dispatchFetch('https://fragweb.test/api/account')).status,200);
 assert.equal((await db.prepare('SELECT count(*) n FROM profiles').first()).n,1);
 assert.equal((await db.prepare("SELECT id FROM profiles WHERE owner_id='other'").first()).id,'keep');
 for(const table of ['marketplace_accounts','marketplace_sessions','listing_likes','listing_comments'])assert.equal((await db.prepare(`SELECT count(*) n FROM ${table} WHERE owner_id='target'`).first()).n,0,table);
 assert.equal((await db.prepare("SELECT password_hash FROM admin_accounts").first()).password_hash,'admin-verifier');
 assert.equal((await db.prepare('SELECT count(*) n FROM admin_sessions').first()).n,1);
 assert.deepEqual(await db.prepare("SELECT status,moderation_status FROM listings WHERE id='target-listing'").first(),{status:'archived',moderation_status:'hidden'});
 assert.equal((await db.prepare("SELECT status FROM listings WHERE id='other-listing'").first()).status,'active');
 assert.equal((await db.prepare("SELECT count(*) n FROM audit_logs WHERE action='requestedProfileRemoved'").first()).n,1);
 assert.equal((await mf.dispatchFetch('https://fragweb.test/api/account')).status,200);assert.equal((await db.prepare('SELECT count(*) n FROM audit_logs').first()).n,1,'idempotent');
 }finally{await mf.dispose();await rm(dir,{recursive:true,force:true});}
});
