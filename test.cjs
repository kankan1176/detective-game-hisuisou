const assert=require('node:assert/strict');const G=require('./dist/engine.js');const D=G.D;
assert.equal(D.people.length,16);assert.equal(new Set(D.people.map(p=>p.type)).size,16);
for(const p of D.people){assert(D.people.find(x=>x.name===p.good));assert(D.people.find(x=>x.name===p.bad));}
for(const l of D.leads){assert(D.people[l.target]);assert(l.min<30);for(const e of [...l.req,...l.give])assert(D.E[e]);for(const k of l.keys)assert(D.K[k]);}
let s=G.initial();const before=JSON.stringify(s);assert.throws(()=>G.talk(s,{a:1,b:1,topic:'case'}));assert.equal(JSON.stringify(s),before);
function ask(b,topic,approach){let a=D.people.find(p=>p.name===D.people[b].good).id; // good pairs are reciprocal in the supplied table
return G.talk(s,{a,b,topic,approach:approach||(D.people[b].type[2]==='T'?'logic':'empathy')});}
// A full route includes corrections and side investigations, with room for one bad action.
const route=[[12,'case'],[2,'case'],[9,'alibi'],[13,'note'],[2,'kitchen'],[1,'case'],[8,'alibi'],[15,'alibi'],[11,'kitchen'],[9,'note'],[13,'kitchen'],[6,'alibi'],[8,'case'],[14,'kitchen'],[5,'note'],[1,'kitchen'],[11,'alibi'],[4,'kitchen'],[10,'kitchen'],[15,'kitchen'],[0,'alibi'],[2,'note'],[12,'kitchen'],[11,'note'],[7,'note']];
for(const [b,t]of route)ask(b,t);assert.equal(s.turn,25);assert(!s.keys.includes('chef'));for(const r of G.comparisons)G.compare(s,r.pair);for(const [,k]of G.slots)assert(s.keys.includes(k),`Missing keyword ${k}`);for(const [,e]of G.proofSlots)assert(s.evidence.includes(e));
while(s.turn<30)ask(3,'case');assert.throws(()=>ask(3,'case'));assert.equal(s.turn,30);assert.equal(G.assess(s,G.slots.map(v=>v[1]),G.proofSlots.map(v=>v[1])).rank,'完全解決');assert.throws(()=>G.assess(s,[],[]));
assert.equal(G.assess(G.initial(),Array(6).fill(''),Array(3).fill('')).rank,'誤認');
// All directional pairs and approaches must remain within trust/turn limits.
let cases=0;for(let a=0;a<16;a++)for(let b=0;b<16;b++)if(a!==b)for(const topic of D.topics)for(const approach of ['listen','logic','empathy','challenge']){const st=G.initial();const e=G.talk(st,{a,b,topic:topic[0],approach});assert.equal(st.turn,1);assert(st.trust.every(n=>n>=0&&n<=4));assert(e.lines.length>=4);cases++;}
// Rumors get corrected and trust zero cannot permanently prevent acquisition.
s=G.initial();for(let i=0;i<3;i++)G.talk(s,{a:2,b:0,topic:'case',approach:'challenge'});assert.equal(s.trust[0],0);assert(s.rumors.length);G.talk(s,{a:2,b:0,topic:'case',approach:'logic'});assert(s.trust[0]>0);ask(12,'case');ask(1,'case');assert(s.rumors[0].corrected);
// Never reveal the actor key before chapter five, even with every requirement.
for(let turn=0;turn<20;turn++){const st=G.initial();st.turn=turn;st.evidence=Object.keys(D.E);G.talk(st,{a:11,b:0,topic:'alibi',approach:'logic'});assert(!st.keys.includes('chef'));}
console.log(`PASS: complete 30-turn route, all ${cases} pair/topic/approach combinations, correction, recovery, end state, clue gating`);

// Manual deductions, directional discoveries and save replay are independently checked.
let manual=G.initial();assert.equal(G.knownRelation(manual,0,11),null);
G.talk(manual,{a:0,b:11,topic:'alibi',approach:'empathy'});
assert.equal(G.knownRelation(manual,0,11),G.relation(0,11));assert.equal(G.knownRelation(manual,11,0),null);
manual.evidence=['metal','structure'];let turn=manual.turn;
assert.equal(G.compare(manual,['metal','structure']).keys.length,2);assert.equal(manual.turn,turn);
assert.equal(G.compare(manual,['structure','metal']).keys.length,0);
assert.throws(()=>G.compare(manual,['metal','metal']));
let gated=G.initial();gated.evidence=Object.keys(D.E);assert.equal(G.compare(gated,['staff','ingredient']).keys.length,0);
let replay=G.initial();for(const [b,topic] of route){G.talk(replay,{a:(b+1)%16,b,topic,approach:D.people[b].type[2]==='T'?'logic':'empathy'});for(const r of G.comparisons)if(r.min<=replay.turn&&r.req.every(e=>G.has(replay,e)))G.compare(replay,r.pair);}
assert.deepEqual(G.hydrate(JSON.parse(JSON.stringify(replay))),replay);
assert.equal(G.assess(replay,G.slots.map(v=>v[1]),G.proofSlots.map(v=>v[1])).rank,'完全解決');
assert.deepEqual(G.hydrate(JSON.parse(JSON.stringify(replay))),replay);
assert.throws(()=>G.compare(replay,['metal','structure']));
console.log('PASS: manual comparison, delayed actor deduction, directional discovery, interleaved save replay');

const legacy={...replay,version:1};assert.equal(G.hydrate(legacy).result.rank,'完全解決');
const badSave=JSON.parse(JSON.stringify(replay));badSave.actions=badSave.actions.filter(a=>a.kind!=='talk');assert.throws(()=>G.hydrate(badSave));
let unrelated=G.initial();unrelated.evidence=['metal','recipe'];const snapshot=JSON.stringify(unrelated);assert.equal(G.compare(unrelated,['metal','recipe']).keys.length,0);assert.equal(JSON.stringify(unrelated),snapshot);
console.log('PASS: legacy save migration, invalid action rejection, failed comparison preserves state');
