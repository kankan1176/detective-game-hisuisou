(function(root){
'use strict';const D=typeof module!=='undefined'?require('./story-data.js'):root.HisuiStory;
function initial(){const knowledge={};for(const p of D.people)knowledge[p.id]=Object.values(D.records).filter(r=>r.owner===p.id).map(r=>r.id);return {version:3,stage:0,scene:0,phase:'intro',acquired:[],knowledge,seen:[],solved:[],board:{},history:[],sequence:0,tutorialShared:false,endingSeen:false};}
const copy=x=>JSON.parse(JSON.stringify(x));
function stage(s){return D.stages[s.stage];}
function audience(s){if(s.stage===0&&s.phase==='free'&&!s.acquired.includes('invite'))return [5,6];if(s.phase==='gather'||s.phase==='board'||s.phase==='debrief')return s.stage===7?D.people.map(p=>p.id):[...new Set(stage(s).scenes.flatMap(c=>c.cast))];return stage(s).scenes[s.scene].cast;}
function requireThat(v,msg){if(!v)throw Error(msg);}
function knows(s,p,id){return !!s.knowledge[p]?.includes(id);}
function record(s,kind,text){s.history.push({order:++s.sequence,stage:s.stage,scene:s.scene,kind,text});}
function addKnowledge(s,ids,rec){for(const p of ids)if(!knows(s,p,rec))s.knowledge[p].push(rec);}
function available(s,r){return !!r && r.stage<=s.stage && s.stage!==1;}
function questions(s,a,b){return Object.values(D.records).filter(r=>available(s,r)&&r.owner===b).map(r=>({id:r.id,locked:r.req.some(e=>!knows(s,a,e)),seen:s.seen.includes(a+':'+r.id)}));}
function ask(s,a,b,id){
 requireThat(['free','gather','board'].includes(s.phase),'今は会話を始められません。');
 requireThat(Number.isInteger(a)&&a>=0&&a<16&&a!==b,'質問する参加者と相手を選んでください。');
 const cast=audience(s);requireThat(cast.includes(a)&&cast.includes(b),'この場面にいる人物を選んでください。');
 const r=D.records[id];requireThat(available(s,r)&&r.owner===b,'この人物には質問できない話題です。');
 requireThat(r.req.every(e=>knows(s,a,e)),'未共有の情報が必要です。');
 const repeat=s.seen.includes(a+':'+id);if(!repeat)s.seen.push(a+':'+id);
 if(!s.acquired.includes(id))s.acquired.push(id);
 const heard=s.stage===0?[5,6]:cast;addKnowledge(s,heard,id);
 record(s,'talk',`${D.people[a].name} → ${D.people[b].name}：${r.title}${repeat?'（再確認）':''}`);
 return {r,repeat,heard};
}
function share(s,a,id){
 requireThat(['free','gather','board'].includes(s.phase),'今は共有できません。');
 const cast=audience(s);requireThat(cast.includes(a)&&a<16&&s.acquired.includes(id)&&knows(s,a,id),'この人物が知っている記録を選んでください。');
 const newPeople=cast.filter(p=>!knows(s,p,id));addKnowledge(s,cast,id);
 if(s.stage===0&&id==='invite'&&knows(s,7,id))s.tutorialShared=true;
 record(s,'share',`${D.people[a].name}が「${D.records[id].title}」を共有`);return newPeople;
}
function missing(s){let ids=stage(s).required.filter(id=>!s.acquired.includes(id));if(s.stage===0&&!s.tutorialShared)ids.push('tutorial-share');return ids;}
function ready(s){return missing(s).length===0;}
function gather(s){requireThat(s.phase==='free'&&ready(s),'まだ確認できることがあります。');s.phase='gather';const cast=audience(s);for(const id of s.acquired)addKnowledge(s,cast,id);record(s,'gather','関係者が合流し、重要情報を共有した。');}
function beginBoard(s){requireThat(s.phase==='gather','先に関係者と合流してください。');s.phase='board';}
function check(s,id,proof,answer){
 requireThat(s.phase==='board','今はボードを検証できません。');const task=stage(s).board?.find(t=>t.id===id);requireThat(task,'推理を選んでください。');
 requireThat(Array.isArray(proof)&&proof.every(p=>s.acquired.includes(p)),'未入手の資料は使えません。');
 s.board[id]={proof:[...new Set(proof)],answer};
 const absent=task.proof.filter(p=>!proof.includes(p));
 if(answer!==task.answer)return {ok:false,message:'結論と資料が示す範囲を見直しましょう。目撃された瞬間と、前後の行動は別です。'};
 if(absent.length)return {ok:false,message:'根拠がまだ足りません。異なる記録を照合し、説明を裏づけてください。'};
 if(!s.solved.includes(id)){s.solved.push(id);record(s,'deduction',task.conclusion);}
 return {ok:true,message:task.conclusion};
}
const challenges={fork:{proof:['menu','returnVideo'],text:'黄色い跡はグラタンでも説明できる。目撃だけではタルトを食べたとは言えない。'},personal:{proof:['personal','shelf'],text:'同じネジを回せる工具は館にもある。持参したことと使用したことは別だ。'},trip:{proof:['shin'],text:'シンが確認したのは資料コーナーでの会話まで。個室往復全体の証明にはならない。'},used:{proof:['stock','used'],text:'予定の栗は未使用で、目撃された工程は別の容器とつながる。材料の取り違えを検証できる。'}};
function challenge(s,id,proof,actor){requireThat(['free','gather','board'].includes(s.phase),'今は照合できません。');const c=challenges[id];requireThat(c&&s.acquired.includes(id),'検証する発言を選んでください。');requireThat(Array.isArray(proof)&&proof.every(p=>s.acquired.includes(p)),'入手済みの記録を選んでください。');requireThat(Number.isInteger(actor)&&actor>=0&&actor<16&&audience(s).includes(actor)&&knows(s,actor,id)&&proof.every(p=>knows(s,actor,p)),'質問役に必要な情報を先に共有してください。');if(!c.proof.every(p=>proof.includes(p)))return {ok:false,message:'この組み合わせだけでは説明を検証できません。別の記録も比べてみましょう。'};record(s,'challenge',c.text);return {ok:true,message:c.text};}
function complete(s,speaker){
 requireThat(s.phase==='board'&&stage(s).board.every(t=>s.solved.includes(t.id)),'重要な推理を確認してください。');
 requireThat(Number.isInteger(speaker)&&speaker>=0&&speaker<16&&audience(s).includes(speaker),'その場の参加者から説明役を選んでください。');
 requireThat(stage(s).board.every(t=>t.proof.every(id=>knows(s,speaker,id))),'説明役に必要な情報を共有してください。');s.phase='debrief';s.speaker=speaker;
}
function checkpoint(s){requireThat(['intro','gather','debrief'].includes(s.phase),'この場面では保存できません。');requireThat(s.stage===1||s.phase==='debrief'||(s.stage===0&&s.tutorialShared),'章を終えてから保存してください。');s.phase='checkpoint';record(s,'checkpoint',`${stage(s).title}を終了`);}
function next(s){requireThat(s.phase==='checkpoint','章末から進んでください。');if(s.stage===7){s.phase='ending';return;}s.stage++;s.scene=0;s.phase='intro';s.solved=[];s.board={};delete s.speaker;}
function hydrate(raw){
 requireThat(raw&&raw.version===3,'この保存データは新しい版に対応していません。以前のデータは削除していません。');
 requireThat(Number.isInteger(raw.stage)&&raw.stage>=0&&raw.stage<D.stages.length&&raw.phase==='checkpoint','保存地点を読み込めません。');
 const s=copy(raw);requireThat(Array.isArray(s.acquired)&&s.acquired.every(id=>D.records[id]&&D.records[id].stage<=s.stage),'記録が破損しています。');
 for(const p of D.people)requireThat(Array.isArray(s.knowledge?.[p.id])&&s.knowledge[p.id].every(id=>D.records[id]),'人物の知識を読み込めません。');
 requireThat(['seen','solved','history'].every(k=>Array.isArray(s[k])),'進行データを読み込めません。');
 requireThat(stage(s).required.every(id=>s.acquired.includes(id))&&(s.stage!==0||s.tutorialShared),'保存データに必要な記録がありません。');return s;
}
const E={D,initial,stage,audience,knows,questions,ask,share,missing,ready,gather,beginBoard,check,complete,checkpoint,next,hydrate,copy,challenges,challenge};root.HisuiFlow=E;if(typeof module!=='undefined')module.exports=E;
})(typeof globalThis!=='undefined'?globalThis:this);
