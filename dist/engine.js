const Game = (()=>{
const D=typeof HISUI!=='undefined'?HISUI:require('./data.js');
const initial=()=>({version:2,actions:[],comparisons:[],turn:0,started:false,ended:false,trust:Array(16).fill(2),evidence:[],keys:['ren','miho','reika','key','fork','unlock','hunger','diet','steal','test','room','garden','magic'],seen:[],history:[],rumors:[],notes:'',result:null,tutorialDone:false});
const has=(s,id)=>s.evidence.includes(id);
const relation=(a,b)=>D.people[a].good===D.people[b].name?'good':D.people[a].bad===D.people[b].name?'bad':'neutral';
const chapter=s=>Math.min(5,Math.floor(s.turn/5));
const available=(s,b,t)=>D.leads.filter(l=>l.target===b&&l.topic===t&&!s.seen.includes(l.id)&&l.min<=s.turn&&l.req.every(e=>has(s,e)));
const hint=(s,b,t)=>{const l=D.leads.find(l=>l.target===b&&l.topic===t&&!s.seen.includes(l.id)); if(!l)return 'この話題の新しい手がかりは取得済み。ほかの話題や人物と照合しよう。';if(l.min>s.turn)return 'まだ思い出せない点があるようだ。次の章で、もう一度尋ねよう。';const missing=l.req.filter(e=>!has(s,e));return missing.length?'照合の糸口：'+missing.map(e=>D.E[e][0]).join('・'):'まだ聞いていない観察がある。落ち着いて尋ねよう。';};
const rumorDefs={alibi:['足音はレンに違いない','photo','足音だけでは人物は特定できない。写真には厨房の運搬盆が写る。'],case:['鍵を持つレイカ以外は取り出せない','structure','施錠は前面扉だけ。天板を外す経路が確認された。'],note:['赤紫のペンを持つミホが声明文を書いた','marker','声明文のペンは厨房の共用品。ミホの私物とは異なる。'],kitchen:['レンのフォークにマロンクリームが付いていた','soup','夕食の写真と照合すると、付着物はパンプキンスープ。']};
const repair=s=>s.rumors.forEach(r=>{if(has(s,r.by))r.corrected=true;});
function dialogueChoices(topic){
const labels={alibi:['その時間、見たり聞いたりしたことを教えて。','時計や記録と照らして、移動の順番を確かめよう。','落ち着いて思い出そう。気になったことはある？','その時間の説明、本当に隠し事はない？'],case:['ケースの周りで、何に気づいた？','鍵と構造を分けて、取り出せる経路を考えよう。','驚いたよね。気になるところから一緒に確認しよう。','ケースに細工をしたのは、あなたじゃない？'],note:['紙や文字について、実際に見たことを教えて。','色だけで決めず、筆記具や前後の文章を比べよう。','この言葉を見て、どんなことが気になった？','この怪しい文章、あなたが書いたんじゃない？'],kitchen:['食材や道具について、気づいたことを教えて。','注文と仕込みの記録を分けて確かめよう。','厨房で、誰か困っている様子はあった？','タルトを隠して食べたんじゃない？']};
return ['listen','logic','empathy','challenge'].map((id,i)=>[id,labels[topic][i]]);
}
function talk(s,{a,b,topic,approach='listen',proof=''}){
if(s.ended||s.turn>=30)throw Error('聴取は終了しています。最終推理へ進んでください。');
if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||a>15||b<0||b>15||a===b||!D.topics.some(t=>t[0]===topic)||!['listen','logic','empathy','challenge'].includes(approach)||proof&&!has(s,proof))throw Error('聞き手・相手・話題を確認してください。');
const x=D.people[a],y=D.people[b],rel=relation(a,b),fit=y.type[2]==='T'?'logic':'empathy',lead=available(s,b,topic)[0];
const relevant=!proof||Boolean(lead&&(lead.req.includes(proof)||lead.give.includes(proof)))||({alibi:['photo','time','roster','miho','foot','staff'],case:['key','metal','structure','sensor','lift'],note:['ink','marker','burnt','full','conceal','reject'],kitchen:['recipe','jars','ingredient','smell','fork','soup','pride','reject']}[topic].includes(proof));
const backed=Boolean(proof&&relevant);const safe=approach===fit||backed;const fail=approach==='challenge'||!relevant||(rel==='bad'&&!safe)||(s.trust[b]===0&&!safe);
const lines=[{speaker:'地の文',text:`${x.name}は${y.name}に向き直った。${D.topics.find(t=>t[0]===topic)[1]}について、${{listen:'まず観察したことから',logic:'事実と推測を分けて',empathy:'気持ちを受け止めながら',challenge:'疑いを強く突きつけて'}[approach]}尋ねる。`},{speaker:x.name,text:dialogueChoices(topic).find(v=>v[0]===approach)[1]}];
if(proof)lines.push({speaker:x.name,text:`「${D.E[proof][0]}」を一緒に見てほしい。${D.E[proof][1]}`});
lines.push({speaker:y.name,text:y.voice});let gained=[],keys=[],outcome;
if(fail){s.trust[b]=Math.max(0,s.trust[b]-1);const rr=rumorDefs[topic];if(!s.rumors.some(r=>r.id===topic))s.rumors.push({id:topic,text:rr[0],by:rr[1],correction:rr[2],corrected:has(s,rr[1]),turn:s.turn+1});lines.push({speaker:y.name,text:!relevant?'その資料を私への疑いに結びつけられても、話が噛み合いません。まず、今の話題に関係することからお願いします。':'その言い方だと、何を答えても疑われる気がする。……もう、さっき広間で出ていた話でいいんじゃないですか。'},{speaker:'地の文',text:`すれ違いの中で「${rr[0]}」という噂が会話に混ざった。裏付けはない。手帳には未確認として記録した。`});outcome='すれ違い / 未確認の噂';
}else{const old=s.trust[b];s.trust[b]=Math.min(4,s.trust[b]+(rel==='good'||safe?2:1));if(lead){s.seen.push(lead.id);lines.push({speaker:y.name,text:lead.text});for(const e of lead.give)if(!has(s,e)){s.evidence.push(e);gained.push(e);}outcome=gained.length||keys.length?'新しい手がかり':'仮説を整理';}else{lines.push({speaker:y.name,text:D.personal[b][D.topics.findIndex(t=>t[0]===topic)]},{speaker:'地の文',text:'今の観察を手帳に残し、別の証言や記録と照合しよう。'});outcome=old===0?'対話を立て直した':'観察を確認';}
if(rel==='good')lines.push({speaker:y.name,text:`${x.name}になら、うまく言えないところも整理してもらえそう。${y.weak}だから、今の話のどこが観察で、どこが解釈かも一緒に確認したい。`});
else if(rel==='bad')lines.push({speaker:'地の文',text:'普段はすれ違う二人も、尋ね方と根拠を揃えることで同じ記録を見られた。相性だけで、情報の真偽は決まらない。'});
else lines.push({speaker:x.name,text:`分かった。${gained.length?'今の観察を記録しよう。別の人の記憶とも照合したい。':'まだ足りない部分は、別の証言とつなげよう。'}思い込みで穴を埋めないようにしよう。`});}
repair(s);s.turn++;const entry={turn:s.turn,a,b,topic,approach,proof,rel,outcome,lines,gained,keys};s.history.push(entry);s.actions.push({kind:'talk',a,b,topic,approach,proof});return entry;
}
const slots=[['人物','chef'],['道具','driver'],['方法','lid'],['原因','mix'],['目的','hide'],['場所','shaft']];
const proofSlots=[['実行者の裏付け','staff'],['持ち出し方法の裏付け','structure'],['隠した理由の裏付け','conceal']];
function assess(s,answer,proofs){if(s.ended)throw Error('この捜査の結果は確定済みです。');const correct=slots.map((v,i)=>answer[i]===v[1]&&s.keys.includes(answer[i]));const evidence=proofSlots.map((v,i)=>proofs[i]===v[1]&&has(s,proofs[i]));const score=correct.filter(Boolean).length+evidence.filter(Boolean).length;const rank=score===9?'完全解決':score>=5?'一部解決':'誤認';s.ended=true;s.result={answer:[...answer],proofs:[...proofs],correct,evidence,score,rank};return s.result;}
const sentence=a=>`${D.K[a[0]]?.[1]||'＿＿'}が、${D.K[a[1]]?.[1]||'＿＿'}を使い、${D.K[a[2]]?.[1]||'＿＿'}した。原因は${D.K[a[3]]?.[1]||'＿＿'}であり、${D.K[a[4]]?.[1]||'＿＿'}、${D.K[a[5]]?.[1]||'＿＿'}に隠れた。`;
const solution='19時45分の確認後、パティシエは最終点検で底層の取り違えに気づいた。19時55分、前面扉を施錠したまま天板をドライバーで外し、盆ごと回収してネジを戻す。声明文を置いて19時56分に廊下へ。20時、パントリー奥の内扉を通り、運転停止中の配膳リフトの整備空間へ隠れた。名声を失うのを恐れ、制作の失敗を盗難に見せかけたのだ。';
const ending=['カズマが整備扉を開けると、白い作業靴が見えた。パティシエが運搬盆を抱え、口の周りにクリームを付けて座っている。「証拠を食べて消そうとしたんです……でも、辛くて全然進まなくて！」', 'レントがため息をつく。「作り直せないから、説明するしかなかった。食べたら記録まで消えるわけじゃないよ」ミホが飲み物を渡し、ナナミは皿を下げた。タルトの提供は中止。代わりの夜食を作ることになった。', 'シンは勤務表を閉じた。「初期条件を確認し直すべきだった」ソウタが笑う。「それ、今日いちばん良い推理じゃない？」レイカは手を叩いた。「反省はあと！ 全員、オニオンスープの準備よ！」', '嵐はまだ続いている。けれど大広間には、16人が少しずつ違う仕方で同じ出来事を理解した、温かい笑い声が戻っていた。'];
// Keywords are conclusions the player makes from independently collected records.
const comparisons=[
{id:'tool',pair:['metal','structure'],req:['metal','structure'],min:0,keys:['driver','lid'],text:'工具傷と構造図が一致する。施錠した前面扉を開けず、ドライバーで天板を外す経路が成立する。'},
{id:'ingredient',pair:['recipe','ingredient'],req:['recipe','jars','smell','ingredient'],min:0,keys:['mix'],text:'注文内容と仕込みの照合から、底層にハバネロ用の容器を使った取り違えが裏付けられる。'},
{id:'actor',pair:['staff','ingredient'],req:['time','staff','structure','ingredient'],min:20,keys:['chef'],text:'時刻・勤務・ケース構造も合わせると、厨房から運んだパティシエの行動として説明がつながる。'},
{id:'motive',pair:['conceal','ingredient'],req:['conceal','ingredient','reject'],min:20,keys:['hide'],text:'取り違えと説明文・声明文の経緯が一致する。制作の失敗を隠すために盗難を演出したと説明できる。'},
{id:'place',pair:['sensor','lift'],req:['sensor','lift'],min:20,keys:['shaft'],text:'内扉の反応と運搬跡がつながる。停止中の配膳リフトの整備空間へ運んだ動線が成立する。'}
];
function compare(s,pair){
if(s.ended)throw Error('この捜査の結果は確定済みです。');
if(!Array.isArray(pair)||pair.length!==2||pair[0]===pair[1]||pair.some(e=>!has(s,e)))throw Error('異なる取得済みの証拠を2つ選んでください。');
const rule=comparisons.find(r=>r.pair.every(e=>pair.includes(e)));
if(!rule)return {keys:[],text:'この2件だけでは重要な結論を裏付けられません。記録の時刻・道具・動線・目的を見直してみましょう。'};
if(rule.min>s.turn||!rule.req.every(e=>has(s,e)))return {keys:[],text:'つながりはありますが、まだ裏付けが不足しています。別の記録も集めてから再照合しましょう。'};
if(s.comparisons.includes(rule.id))return {keys:[],text:'この照合は記録済みです。'+rule.text};
s.comparisons.push(rule.id);const keys=rule.keys.filter(k=>!s.keys.includes(k));s.keys.push(...keys);s.actions.push({kind:'compare',pair:[...pair]});return {keys,text:rule.text};
}
const knownRelation=(s,a,b)=>s.history.some(h=>h.a===a&&h.b===b)?relation(a,b):null;
function hydrate(raw){
if(![1,2].includes(raw.version)||!Array.isArray(raw.history)||raw.history.length>30||raw.turn!==raw.history.length||typeof raw.notes!=='string'||raw.notes.length>50000)throw Error('保存記録の形式が異なります。');
const st=initial();st.started=Boolean(raw.started);
if(raw.version===2){
if(!Array.isArray(raw.actions)||raw.actions.length>35)throw Error('行動記録の形式が異なります。');
for(const action of raw.actions){if(action.kind==='talk')talk(st,action);else if(action.kind==='compare'){const result=compare(st,action.pair);if(!result.keys.length)throw Error('照合記録の形式が異なります。');}else throw Error('未知の行動記録です。');}
if(st.turn!==raw.turn||JSON.stringify(st.history.map(h=>[h.a,h.b,h.topic,h.approach,h.proof]))!==JSON.stringify(raw.history.map(h=>[h.a,h.b,h.topic,h.approach,h.proof])))throw Error('会話記録が一致しません。');
}else{ // Preserve conclusions already earned in an older saved game.
for(const h of raw.history)talk(st,h);
for(const rule of comparisons)if(rule.min<=st.turn&&rule.req.every(e=>has(st,e))&&rule.keys.every(k=>Array.isArray(raw.keys)&&raw.keys.includes(k)))compare(st,rule.pair);
}
st.notes=raw.notes;st.tutorialDone=raw.tutorialDone===undefined?Boolean(raw.history.length||raw.ended):raw.tutorialDone===true;
if(raw.ended){if(!raw.result||!Array.isArray(raw.result.answer)||raw.result.answer.length!==6||!Array.isArray(raw.result.proofs)||raw.result.proofs.length!==3||raw.result.answer.some(k=>k&&!D.K[k])||raw.result.proofs.some(k=>k&&!D.E[k]))throw Error('結果の形式が異なります。');assess(st,raw.result.answer,raw.result.proofs);}return st;
}
return {D,dialogueChoices,comparisons,compare,knownRelation,initial,has,relation,chapter,available,hint,talk,assess,slots,proofSlots,sentence,solution,ending,hydrate};
})();
if(typeof module!=='undefined')module.exports=Game;
