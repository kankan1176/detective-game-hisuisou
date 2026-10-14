// Original staging using the existing manor, cast, expression and sound assets.
const PROLOGUE_STAGES = [
  {place:'翡翠荘・外観',time:'嵐の夜',scene:'exterior',cast:[8,15],faces:[0,0]},
  {place:'パントリー',time:'19:45',scene:'pantry',cast:[2,8],faces:[0,1]},
  {place:'大広間',time:'20:15',scene:'hall',cast:[15,2],faces:[2,2]},
  {place:'受付の連絡板',time:'捜査の前に',scene:'hall',cast:[11,6],faces:[1,1]},
  {place:'大広間',time:'捜査開始',scene:'hall',cast:[2,0],faces:[3,1]}
];
function shortBeats(text, speaker='地の文') {
  const result=[];
  for (const paragraph of text.split('\n').filter(Boolean)) {
    // Short complete sentences are readable without shrinking the type.
    const sentences=paragraph.match(/[^。！？]+[。！？][」』]?|[^。！？]+$/g)||[paragraph];
    let part='';
    for(const sentence of sentences){
      if(part.length+sentence.length>76&&part){result.push({speaker,text:part});part='';}
      part+=sentence;
    }
    if(part)result.push({speaker,text:part});
  }
  return result;
}
const PROLOGUE_BEATS=HISUI.opening.map((text,i)=>{
  if(i===4){
    const [before,rest]=text.split('「');const [speech,after]=rest.split('」');
    return [...shortBeats(before),...shortBeats(speech,'レイカ'),...shortBeats(after.replace(/^――/,'')),
      {speaker:'レイカ',text:'まずは、誰が何を見たかを聞きましょう。集まった記録は手帳で比べるの。操作練習で一度、試してみましょう。'}];
  }
  const beats=shortBeats(text);
  if(i===1)beats.push({speaker:'タクミ',text:'確認した時刻と、鍵を持っている人を記録しておきます。あとで思い出すときの、大事な手がかりになりますから。'});
  if(i===2)for(const beat of beats)if(beat.text.startsWith('「大変'))beat.speaker='カレン';
  if(i===3)beats.push({speaker:'ナナミ',text:'みんなが何をしていたか、決めつけずに聞いてみましょう。分からないことは、記録を一つずつ確かめればいいんです。'});
  return beats;
});
let openingLine=0, lastOpeningScene=-1;
intro=function(){
  if(openingPage!==lastOpeningScene){openingLine=0;lastOpeningScene=openingPage;}
  const stage=PROLOGUE_STAGES[openingPage],beats=PROLOGUE_BEATS[openingPage];
  const beat=beats[openingLine],last=openingLine===beats.length-1,final=last&&openingPage===PROLOGUE_STAGES.length-1;
  const cast=stage.cast.map((id,n)=>`<figure class="cinema-actor ${HISUI.people[id].name===beat.speaker?'is-speaking':''}">${portrait(id,stage.faces[n],'cinema-portrait')}<figcaption>${HISUI.people[id].name}</figcaption></figure>`).join('');
  $('#app').innerHTML=`<section class="cinema" aria-label="会話形式のプロローグ"><div class="cinema-top"><span>PROLOGUE ${String(openingPage+1).padStart(2,'0')} / 05</span><span>${stage.time} · ${stage.place}</span><button id="opening-index" class="quiet">導入を読み返す</button></div><div class="cinema-stage">${backdrop(stage.scene)}<div class="cinema-vignette"></div><div class="cinema-cast">${cast}</div><div class="cinema-location">${stage.place}</div><section class="cinema-dialogue"><h2 class="cinema-name">${beat.speaker==='地の文'?'翡翠荘':beat.speaker}</h2><p id="opening-text" aria-live="polite">${esc(beat.text)}</p><div class="cinema-controls"><button id="intro-back" ${openingPage===0&&openingLine===0?'disabled':''}>前の言葉</button><span>${openingLine+1} / ${beats.length}</span><button id="intro-next" class="primary">${final?'操作練習へ →':last?'次の場面へ →':'次の言葉 →'}</button></div></section></div><p class="cinema-caption">${final?'次は、実際の操作を練習します。練習では対話回数や証拠は変わりません。':'名前札が話し手です。長い文章は「次のページ」、会話は「次の言葉」で進みます。'}</p></section>`;
  $('#intro-back').onclick=()=>{
    if(openingLine>0)openingLine--;
    else{openingPage--;lastOpeningScene=openingPage;openingLine=PROLOGUE_BEATS[openingPage].length-1;}
    intro();
  };
  $('#intro-next').onclick=()=>{
    if(final){if(!state.tutorialDone)beginPractice();else{view='board';render();}return;}
    if(last){openingPage++;lastOpeningScene=openingPage;openingLine=0;}else openingLine++;
    Sounds.play('sfx-page');intro();
  };
  $('#opening-index').onclick=()=>modal(`<h2>嵐の夜と、消えた至宝</h2>${HISUI.opening.map((s,i)=>`<h3>場面 ${i+1}</h3><p class="authored-copy">${esc(s)}</p>`).join('')}`);
  Sounds.play(openingPage<2?'bgm-title':'bgm-investigation',true);applyMotion();
};
const cinematicCover=cover;
cover=function(){
  cinematicCover();
  if($('#resume'))$('#resume').onclick=()=>{
    if(!state.ended&&!state.tutorialDone&&state.turn===0){openingPage=0;openingLine=0;lastOpeningScene=-1;view='opening';}
    else view=state.ended?'result':'board';
    render();
  };
};
const cinematicStart=start;
start=function(){openingLine=0;lastOpeningScene=-1;cinematicStart();};

const CHAPTER_GOALS=[
  '鍵の管理とケースの様子から、事件の出発点を確かめよう。',
  '時刻・写真・ケースの構造を集め、記録どうしを比べよう。',
  '道具の持ち主と、付いているものを分けて確かめよう。',
  '注文と仕込みの記録を比べ、思い込みを訂正しよう。',
  '館で働く人の動きと、奥の設備の記録をつなごう。',
  '手帳を見直し、6つの言葉と3件の証拠で説明を作ろう。'
];
function nextAction(){
  if(state.turn>=30)return {kind:'final',title:'集めた記録で、最終推理を組み立てよう。',detail:'もう新しい対話はできません。照合は続けられます。手帳を見直し、人物・道具・方法・原因・目的・場所と、裏付けの証拠3件を選びましょう。'};
  const comparison=Game.comparisons.find(r=>!state.comparisons.includes(r.id)&&r.min<=state.turn&&r.req.every(e=>Game.has(state,e)));
  if(comparison)return {kind:'compare',comparison,title:'つながりそうな記録を、手帳で比べてみよう。',detail:`「${HISUI.E[comparison.pair[0]][0]}」と「${HISUI.E[comparison.pair[1]][0]}」が揃いました。手帳の「証拠を照合する」で2件を選びます。照合では対話回数を使いません。`};
  const lead=HISUI.leads.find(l=>l.give.some(e=>!Game.has(state,e))&&l.min<=state.turn&&!state.seen.includes(l.id)&&l.req.every(e=>Game.has(state,e)));
  if(lead){const person=HISUI.people[lead.target],topic=HISUI.topics.find(t=>t[0]===lead.topic)[1];return {kind:'talk',lead,person,title:`${person.name}に「${topic}」を聞いてみよう。`,detail:'これは次の質問の候補です。聞き手と話し相手を選び、話題とセリフを確かめてから「話しかける」を押しましょう。選択を変えるだけでは回数を使いません。'};}
  return {kind:'talk',title:'別の人物や話題から、観察を集めよう。',detail:'まだ裏付けが足りない話は、後の章で聞けることもあります。手帳と会話履歴を読み返し、気になる点を別の相手にも尋ねましょう。「ヒントを見る」も使えます。'};
}
function revealControl(selector){document.dispatchEvent(new CustomEvent('folio:reveal',{detail:{selector}}));requestAnimationFrame(()=>{const el=$(selector);el?.focus({preventScroll:true});el?.classList.add('tutorial-target');setTimeout(()=>el?.classList.remove('tutorial-target'),2400);});}
function showNextAction(){
  const task=nextAction(),ch=Game.chapter(state);
  modal(`<span class="eyebrow">今の目的 · 第${ch+1}章</span><h2>${esc(task.title)}</h2>${task.person?`<div class="guide-person">${portrait(task.person.id,0,'guide-portrait')}<strong>${task.person.name}</strong></div>`:''}<p>${esc(task.detail)}</p><ol class="action-flow"><li><strong>聞く</strong> 人物 → 話題 → セリフ → 対話</li><li><strong>比べる</strong> 手帳で証拠を2件照合</li><li><strong>説明する</strong> 最終推理を言葉と証拠で作る</li></ol><p>今の章の目標：${CHAPTER_GOALS[ch]}</p><button class="primary" id="follow-action">${task.kind==='compare'?'手帳の照合を開く':task.kind==='final'?'最終推理を開く':task.person?'この質問を準備する':'対話の操作を確認する'}</button><button id="chapter-story">この章の導入を読む</button>`);
  $('#follow-action').onclick=()=>{
    $('#modal').close();
    if(view==='reading'&&task.kind==='talk'){toast('会話を最後まで読み、「手がかりを記録」から捜査に戻りましょう。');return;}
    if(task.kind==='compare'||task.kind==='final'){
      sideTab=task.kind==='compare'?'notebook':'final';
      if(view!=='reading'){view='board';render();}else{document.querySelector(`[data-reference="${sideTab}"]`)?.click();}
      openReference();
      if(task.kind==='compare'){
        $('#compare-0').value=task.comparison.pair[0];$('#compare-1').value=task.comparison.pair[1];
        revealControl('#compare-evidence');
      }
    }else{
      if(task.lead){selection.b=task.lead.target;if(selection.a===selection.b)selection.a=(selection.b+1)%16;selection.topic=task.lead.topic;selection.approach=HISUI.people[selection.b].type[2]==='T'?'logic':'empathy';selection.proof='';}
      view='board';render();revealControl('[data-picker="a"]');
    }
  };
  $('#chapter-story').onclick=()=>{
    const cast=[15,6,14,1,11,2][ch];
    $('#modal-body').innerHTML=`<div class="chapter-illustration">${backdrop(['pantry','hall','hall','study','hall','hall'][ch],false)}${portrait(cast,1,'chapter-portrait')}</div><h2>第${ch+1}章 · ${HISUI.acts[ch][0]}</h2><p class="authored-copy">${esc(HISUI.acts[ch][1])}</p><p>次の目標：${CHAPTER_GOALS[ch]}</p><button id="back-to-action" class="primary">進め方に戻る</button>`;
    $('#back-to-action').onclick=showNextAction;
  };
}
function installMission(){
  if(practice||state.ended||$('#mission')||!$('#workspace'))return;
  const mission=document.createElement('section');mission.id='mission';mission.setAttribute('aria-label','今の目的');
  mission.innerHTML=`<div><span class="eyebrow">次にすること</span><strong>${view==='reading'?'会話を読み、手がかりを記録しよう。':esc(nextAction().title)}</strong></div><button id="mission-help">進め方を見る</button>`;
  $('#app').prepend(mission);$('#mission-help').onclick=showNextAction;
}
function openReference(){
  $('#workspace')?.classList.add('reference-open');
  const button=$('#reference-toggle');if(button){button.textContent='資料を閉じる';button.setAttribute('aria-expanded','true');}
  window.dispatchEvent(new Event('resize'));
}
function closeReference(){
  $('#workspace')?.classList.remove('reference-open');
  const button=$('#reference-toggle');if(button){button.textContent='資料を開く';button.setAttribute('aria-expanded','false');}
  window.dispatchEvent(new Event('resize'));
}
const cinematicWorkspace=workspace;
workspace=function(){
  cinematicWorkspace();
  if(!$('#workspace')||$('#desk-toolbar'))return;
  const toolbar=document.createElement('div');toolbar.id='desk-toolbar';
  toolbar.innerHTML='<span>対話と資料を切り替える</span><button id="reference-toggle" aria-expanded="false" aria-controls="reference">資料を開く</button>';
  $('#workspace').before(toolbar);
  $('#reference-toggle').onclick=()=>$('#workspace').classList.contains('reference-open')?closeReference():openReference();
  if(practice&&[9,11,12,13].includes(practice.stage))openReference();
  if(state.ended)openReference();
};
// Reveal a document control before the pagination engine measures its page.
document.addEventListener('folio:reveal',event=>{
  const target=$(event.detail.selector);
  if(target?.closest('#reference')&&matchMedia('(max-width:599px)').matches)openReference();
});
const cinematicBoard=board;
board=function(){
  cinematicBoard();
  if($('#to-final'))$('#to-final').onclick=()=>{sideTab='final';view='board';board();openReference();};
  installMission();
};
const cinematicDialogue=renderDialogue;
renderDialogue=function(){
  cinematicDialogue();
  $('#play-column .novel')?.classList.add('story-scene');
  document.querySelectorAll('.novel-cast .cast-slot').forEach((el,i)=>{
    const id=i===0?shown.a:shown.b;
    el.setAttribute('role','img');el.setAttribute('aria-label',HISUI.people[id].name);
  });
  installMission();
};
const cinematicResult=result;
result=function(){
  cinematicResult();
  if($('#result-notes'))$('#result-notes').onclick=()=>{sideTab='notebook';view='board';render();};
};
// Keep feedback visible when the paginated notebook is rebuilt after comparison.
document.addEventListener('click',e=>{
  if(e.target.closest('#compare-evidence'))requestAnimationFrame(()=>{
    revealControl('#compare-feedback');
    const mission=$('#mission strong');if(mission)mission.textContent=nextAction().title;
  });
});
render();
