/* Operation guidance only: never chooses a witness, evidence or an answer. */
(function(root){
'use strict';
const F=typeof module!=='undefined'?require('./story-engine.js'):root.HisuiFlow;
function next(c){
 const {state:s,tab,actor,target,dialogue,tutorial={},talkStep='actor',modal}=c;
 const make=(id,text,selector,note='')=>({id,text,selector,note});
 if(!s)return null;
 if(modal){
  if(modal.kind==='record'&&['free','gather','board'].includes(s.phase)){
   if(!F.knows(s,actor,modal.id)||actor>=16||!F.audience(s).includes(actor))return make('share-source','この情報を知っている、伝える人を選ぼう','#modal .share-source-field','読むだけでは人物には伝わりません。');
   return make('share',s.stage===0&&!s.tutorialShared?'⑥ この場の全員に伝え、ユウキにも案内を共有しよう':'必要なら、この場の全員に情報を伝えよう',`#modal [data-share="${modal.id}"]`,'読み終えたら「閉じる」で戻れます。');
  }
  if(modal.kind==='explain')return make('speaker','推理を説明する人を自由に選ぼう','#modal .chips');
  return make('close','確認したら「閉じる」で戻ろう','#close-modal');
 }
 if(dialogue)return make('read','「次へ」で会話の続きを読もう','.workspace [data-action="dialogue-next"]','会話中は質問する人を選び直す必要はありません。');
 if(s.phase==='checkpoint')return s.savedOK?make('next-chapter','次へ進むか、ここで終了しよう','[data-action="next-stage"]','自動セーブ済み。タイトルへ戻っても再開できます。'):make('retry-save','保存できませんでした。保存を再試行しよう','[data-action="retry-save"]','保存が完了するまで、この画面を閉じずに待ちましょう。');
 if(s.phase==='intro')return make('intro','「物語を読む」で始めよう','[data-action="begin-intro"]');
 if(s.phase==='gather')return make('begin-board','情報が揃いました。推理ボードへ進もう','[data-action="begin-board"]');
 if(s.phase==='board'){
  const task=F.stage(s).board.find(t=>!s.solved.includes(t.id));
  if(!task)return make('explain','重要な推理を確認できました。みんなに伝えよう','[data-action="explain"]');
  if(tab!=='board')return make('board-tab','「推理」を開いて、記録を組み合わせよう','[data-tab="board"]');
  const b=s.board[task.id]||{proof:[],answer:''},prefix=`[data-task="${task.id}"]`;
  if(!b.proof.length)return make('proof','① 根拠に使いたい記録を選ぼう',prefix+' .proof-options','複数選べます。正しい組み合わせは自分で考えましょう。');
  if(!b.answer)return make('answer','② 根拠を選び終えたら、結論を選ぼう',prefix+' .answer-field','根拠は複数選べます。選んだ記録は、まだ追加・変更できます。');
  return make('check','③ 「この推理を確認」で確かめよう',prefix+' [data-check]','違っていても何度でも選び直せます。');
 }
 if(s.phase!=='free')return null;
 if(s.stage===0){
  if(F.ready(s))return make('tutorial-gather','練習完了。「展示へ向かう」で先へ進もう','[data-action="gather"]');
  if(!s.acquired.includes('invite')){
   if(tab!=='talk')return make('tutorial-talk','「会話」を開いて練習を続けよう','[data-tab="talk"]');
   if(actor!==5||!tutorial.actor)return make('tutorial-actor','① 質問する人に「アオイ」を選ぼう','[data-actor="5"]');
   if(target!==6||!tutorial.target)return make('tutorial-target','② 話す相手に「ハヤト」を選ぼう','[data-target="6"]');
   return make('tutorial-topic','③ 「紹介展示の案内」を押して質問しよう','[data-ask="invite"]');
  }
  if(tab!=='records')return make('tutorial-records','④ 「記録」を開こう','[data-tab="records"]','会話で聞いた内容が、自動で記録されています。');
  return make('tutorial-record','⑤ 「紹介展示の案内」を開こう','[data-record="invite"]','次は、案内を知らないユウキに伝える練習です。');
 }
 if(F.ready(s))return make('gather',s.stage===1?'会話を楽しんだら「夕食へ進む」を押そう':'重要な情報が揃いました。「合流へ進む」を押そう','[data-action="gather"]','残りの会話も自由に楽しめます。');
 if(tab==='records'&&!s.acquired.length)return make('no-records','まだ記録はありません。「会話」に戻ろう','[data-tab="talk"]');
 if(tab==='records')return make('record','記録を選び、内容や共有先を確認しよう','.record-list','調査を続けるときは「会話」に戻れます。');
 if(tab==='people')return make('person','人物を選び、知っている情報を確認しよう','.people-grid','調査を続けるときは「会話」に戻れます。');
 if(tab!=='talk')return make('talk-tab','今は調べる時間。「会話」に戻って話を聞こう','[data-tab="talk"]','推理の確認は、合流した後に行います。');
 if(talkStep==='actor')return make('actor','① 質問する人を自由に選ぼう','[data-guide="actors"]');
 if(talkStep==='target')return make('target','② 話す相手を自由に選ぼう','[data-guide="targets"]');
 const qs=F.questions(s,actor,target);
 if(qs.length&&qs.every(q=>q.locked))return make('locked','質問に必要な情報を「記録」から伝えよう','[data-tab="records"]','情報を知る人から共有するか、質問する人を選び直せます。');
 return make('topic','③ 聞きたい話題を自由に選ぼう','[data-guide="topics"]','人物や場面は、いつでも選び直せます。');
}
function phase(s,dialogue){
 if(s.phase==='checkpoint')return {index:3,label:'章クリア・保存'};
 if(['board','debrief'].includes(s.phase))return {index:2,label:dialogue?'推理を伝える時間':'推理する時間'};
 if(s.phase==='gather')return {index:1,label:'合流して情報を共有する時間'};
 return {index:0,label:dialogue||s.phase==='intro'?'会話を読む時間':'会話で調べる時間'};
}
const G={next,phase};root.HisuiGuide=G;if(typeof module!=='undefined')module.exports=G;
})(typeof globalThis!=='undefined'?globalThis:this);
