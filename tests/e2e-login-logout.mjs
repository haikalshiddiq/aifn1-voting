import assert from "node:assert/strict";
import { handle } from "../worker/src/index.js";

class Statement {
  constructor(db, sql) { this.db=db; this.sql=sql.replace(/\s+/g," ").trim(); this.args=[]; }
  bind(...args){ this.args=args; return this; }
  async first(){
    const s=this.sql, a=this.args;
    if(s.startsWith("SELECT nim,name FROM students WHERE nim=?")) return this.db.students.get(a[0]) || null;
    if(s.startsWith("SELECT token_hash,nim,role,expires_at FROM sessions")) {
      const x=this.db.sessions.get(a[0]); return x && new Date(x.expires_at)>new Date() ? x : null;
    }
    if(s.startsWith("SELECT nim,name FROM students WHERE nim=?")) return this.db.students.get(a[0]) || null;
    if(s.startsWith("SELECT * FROM votes WHERE nim=?")) return this.db.votes.get(a[0]) || null;
    if(s.startsWith("SELECT setting_value FROM settings")) return {setting_value:this.db.settings.get(a[0])};
    if(s.startsWith("SELECT COUNT(*) n FROM students")) return {n:this.db.students.size};
    if(s.startsWith("SELECT COUNT(*) n FROM votes")) return {n:this.db.votes.size};
    throw new Error("Unhandled first SQL: "+s);
  }
  async all(){
    if(this.sql.startsWith("SELECT group_method label")) return {results:[]};
    if(this.sql.includes("SELECT theme label,SUM(points)")) return {results:[]};
    throw new Error("Unhandled all SQL: "+this.sql);
  }
  async run(){
    const s=this.sql,a=this.args;
    if(s.startsWith("DELETE FROM sessions WHERE julianday")){ for(const [k,v] of this.db.sessions) if(new Date(v.expires_at)<=new Date()) this.db.sessions.delete(k); return {success:true}; }
    if(s.startsWith("INSERT INTO sessions")){ this.db.sessions.set(a[0],{token_hash:a[0],nim:a[1],role:a[2],expires_at:a[3]}); return {success:true}; }
    if(s.startsWith("DELETE FROM sessions WHERE token_hash=?")){ this.db.sessions.delete(a[0]); return {success:true}; }
    if(s.startsWith("INSERT INTO audit_log")) return {success:true};
    if(s.startsWith("INSERT INTO votes")){
      const old=this.db.votes.get(a[0]);
      this.db.votes.set(a[0],{nim:a[0],group_method:a[1],theme_rank_1:a[2],theme_rank_2:a[3],theme_rank_3:a[4],theme_rank_4:a[5],theme_rank_5:a[6],custom_theme:a[7],reason:a[8],created_at:old?.created_at||new Date().toISOString(),updated_at:new Date().toISOString()});
      return {success:true};
    }
    throw new Error("Unhandled run SQL: "+s);
  }
}
class FakeDB {
  constructor(){
    this.students=new Map([["25110200041",{nim:"25110200041",name:"AINUN KHOLISHAH"}]]);
    this.sessions=new Map(); this.votes=new Map();
    this.settings=new Map([["voting_status","open"],["deadline","2099-11-29T23:59:00+07:00"]]);
  }
  prepare(sql){ return new Statement(this,sql); }
  async batch(statements){ for(const x of statements) await x.run(); return []; }
}
const DB=new FakeDB();
const env={DB,BYPASS_TURNSTILE:"true",ALLOWED_ORIGINS:"https://example.github.io",TURNSTILE_SITE_KEY:"1x00000000000000000000AA"};
const origin="https://example.github.io";
async function call(path,{method="GET",token,body}={}){
  const headers={Origin:origin}; if(body) headers["Content-Type"]="application/json"; if(token) headers.Authorization=`Bearer ${token}`;
  const req=new Request(`https://api.example.test${path}`,{method,headers,body:body?JSON.stringify(body):undefined});
  const res=await handle(req,env); const data=await res.json(); return {res,data};
}

const login1=await call("/api/login",{method:"POST",body:{nim:"25110200041",name:"AINUN KHOLISHAH",turnstileToken:"test"}});
assert.equal(login1.res.status,200); assert.ok(login1.data.token);
const token1=login1.data.token;
let me=await call("/api/me",{token:token1}); assert.equal(me.res.status,200); assert.equal(me.data.nim,"25110200041");
const vote={group_method:"Berdasarkan minat tema UTS",theme_rank_1:"Pembiayaan UMKM",theme_rank_2:"Pinjaman Koperasi",theme_rank_3:"Piutang Pelanggan Usaha",theme_rank_4:"Kemampuan Bayar Kredit Konsumtif",theme_rank_5:"Tema Finance Usulan Sendiri",custom_theme:"Deteksi fraud kartu kredit",reason:"Minat utama"};
let saved=await call("/api/vote",{method:"PUT",token:token1,body:vote}); assert.equal(saved.res.status,200); assert.equal(saved.data.ok,true);
let logout=await call("/api/logout",{method:"POST",token:token1}); assert.equal(logout.res.status,200);
me=await call("/api/me",{token:token1}); assert.equal(me.res.status,401,"token lama harus tidak valid setelah logout");
const login2=await call("/api/login",{method:"POST",body:{nim:"25110200041",name:"AINUN KHOLISHAH",turnstileToken:"test2"}});
assert.equal(login2.res.status,200); assert.notEqual(login2.data.token,token1);
const restored=await call("/api/vote",{token:login2.data.token}); assert.equal(restored.res.status,200); assert.equal(restored.data.vote.custom_theme,"Deteksi fraud kartu kredit");
console.log("PASS E2E: login -> save vote -> logout -> old token rejected -> login again -> prior vote restored");
