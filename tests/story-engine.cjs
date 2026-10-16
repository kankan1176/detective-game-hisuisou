const assert=require('node:assert/strict');const F=require('../dist/story-engine.js');const D=F.D;
const s=F.initial();s.phase='free';
const before=JSON.stringify(s);assert.throws(()=>F.ask(s,5,5,'invite'));assert.equal(JSON.stringify(s),before);
F.ask(s,5,6,'invite');assert(F.knows(s,5,'invite'));assert(!F.knows(s,7,'invite'));assert(!F.ready(s));assert.throws(()=>F.share(s,7,'invite'));F.share(s,5,'invite');assert(F.ready(s));F.gather(s);F.checkpoint(s);assert.deepEqual(F.hydrate(F.copy(s)),s);
let checkpoints=1,questions=1,tasks=0;
for(let stage=1;stage<D.stages.length;stage++){
 F.next(s);assert.equal(s.stage,stage);if(stage===1){F.checkpoint(s);checkpoints++;continue;}s.phase='free';
 // Reach every required record through public operations, solving knowledge gates by actual sharing.
 let pending=new Set(D.stages[stage].required),guard=0;
 while(pending.size&&guard++<60){let changed=false;
 for(const id of [...pending]){const r=D.records[id],i=D.stages[stage].scenes.findIndex(c=>c.cast.includes(r.owner)&&c.cast.some(p=>p<16&&p!==r.owner&&r.req.every(e=>F.knows(s,p,e))));if(i<0)continue;s.scene=i;const cast=F.audience(s),a=cast.find(p=>p<16&&p!==r.owner&&r.req.every(e=>F.knows(s,p,e)));
 if(a===undefined){for(const req of r.req){if(s.acquired.includes(req)){const source=cast.find(p=>p<16&&F.knows(s,p,req));if(source!==undefined)F.share(s,source,req);}}continue;}
 F.ask(s,a,r.owner,id);questions++;pending.delete(id);changed=true;
 }if(!changed&&pending.size){for(const i of D.stages[stage].scenes.keys()){s.scene=i;for(const id of s.acquired){const a=F.audience(s).find(p=>p<16&&F.knows(s,p,id));if(a!==undefined)F.share(s,a,id);}}}
 }
 assert.equal(pending.size,0,'unreachable '+[...pending]);assert(F.ready(s));F.gather(s);F.beginBoard(s);
 for(const t of D.stages[stage].board){assert(!F.check(s,t.id,[],t.answer).ok);assert(!F.check(s,t.id,t.proof,'誤答').ok);assert(F.check(s,t.id,t.proof,t.answer).ok);tasks++;}
 F.complete(s,F.audience(s).find(p=>p<16));F.checkpoint(s);const restored=F.hydrate(F.copy(s));assert.deepEqual(restored,s);checkpoints++;
}
assert.equal(checkpoints,8);s.phase='board';assert(!F.challenge(s,'fork',['menu'],0).ok);assert(F.challenge(s,'fork',['menu','returnVideo'],0).ok);s.phase='checkpoint';F.next(s);assert.equal(s.phase,'ending');assert.equal(D.people.length,23);
const broken=F.copy(s);broken.phase='checkpoint';broken.knowledge[5]=['nonexistent'];assert.throws(()=>F.hydrate(broken));
// Self questions, absent listeners, unavailable future evidence and invalid proof must not mutate state.
const x=F.initial();x.phase='free';let snapshot=JSON.stringify(x);assert.throws(()=>F.ask(x,5,8,'photo'));assert.equal(JSON.stringify(x),snapshot);
assert.throws(()=>F.checkpoint(x));
console.log(`PASS story: ${checkpoints} checkpoints, ${questions} required questions, ${tasks} deductions, knowledge/share gates, wrong-answer recovery, save roundtrips, all 23 cast entries`);
