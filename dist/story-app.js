/* Browser UI for chapter-based narrative. Legacy saves are intentionally untouched. */
'use strict';
const F=HisuiFlow,D=HisuiStory,$=s=>document.querySelector(s),app=$('#app');
const SAVE_KEY='hisui.chapter-checkpoints.v3';
let state=null,view='title',tab='talk',actor=5,target=6,dialogue=null,endingIndex=0,endingTimer=null,lastProgress=Date.now(),hintOffered=false,feedback={},modalReturn=null;
let tutorialGuide={actor:false,target:false},talkStep='actor',guideModal=null,noticeText='';
const sound={on:false,bgm:null,track:'',play(name,story=false){if(!this.on)return;const a=new Audio((story?'assets/story/audio/':'assets/audio/')+name+'.wav');a.volume=.24;a.play().catch(()=>{});},music(name){if(this.track===name)return;this.bgm?.pause();this.track=name;if(!this.on)return;this.bgm=new Audio('assets/audio/'+name+'.wav');this.bgm.loop=true;this.bgm.volume=.12;this.bgm.play().catch(()=>{});}};
function escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function progress(){lastProgress=Date.now();hintOffered=false;}
function toast(text){
 const region=$('#toast');region.textContent=text;clearTimeout(toast.timer);
 const inline=view==='game'&&$('.guide-summary small')&&!$('#modal').open;
 noticeText=inline?text:'';region.classList.toggle('show',!inline);updateNotice();
 toast.timer=setTimeout(()=>{noticeText='';region.classList.remove('show');updateNotice();},4200);
}
function updateNotice(){
 const el=$('.guide-summary small');if(!el||!state)return;
 el.textContent=noticeText||HisuiGuide.phase(state,dialogue).label;
 el.title=noticeText;el.classList.toggle('operation-notice',!!noticeText);
}
function modal(title,body){guideModal={kind:'other'};$('#modal-title').textContent=title;$('#modal-body').innerHTML=body;if(!$('#modal').open){modalReturn=document.activeElement;$('#modal').showModal();}updateGuide();}
function closeModal(){guideModal=null;$('#modal').close();updateGuide();if(modalReturn?.isConnected)modalReturn.focus();}
$('#close-modal').onclick=closeModal;
$('#modal').addEventListener('close',()=>{guideModal=null;updateGuide();});
function readBook(){try{const b=JSON.parse(localStorage.getItem(SAVE_KEY)||'{"slots":{}}');if(!b||typeof b.slots!=='object'||!b.slots)return {slots:{}};return b;}catch{return {slots:{}};}}
function entries(){return Object.entries(readBook().slots).flatMap(([id,v])=>{try{F.hydrate(v.state);return [{id:Number(id),...v}];}catch{return [];}});}
function saveCheckpoint(){try{const book=readBook();book.slots[state.stage]={state:F.copy(state),savedAt:Date.now()};localStorage.setItem(SAVE_KEY,JSON.stringify(book));return true;}catch{return false;}}
function latest(){return entries().sort((a,b)=>b.savedAt-a.savedAt)[0];}
function portrait(id,face=0,cls=''){
 const p=D.people[id];if(!p)return '';
 const key=`${id}:${face}`,replacement=window.HisuiSpriteArt?.replacements[key];
 const col=face%3,row=p.row===null?Math.floor(face/3):p.row;
 const bounds=replacement||window.HisuiSpriteBounds?.[p.art]?.[row*3+col];
 const rectangles=window.HisuiSpriteArt?.masks[key]||[];
 // Mask only measured fragments from neighboring cells; keep this person's fingers and props.
 let mask='';
 if(rectangles.length){
  const d='M0 0H512V512H0Z '+rectangles.map(([x,y,r,b])=>`M${x} ${y}H${r}V${b}H${x}Z`).join(' ');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="white" fill-rule="evenodd" d="${d}"/></svg>`;
  const url=`url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  mask=`mask-image:${url};-webkit-mask-image:${url};mask-size:100% 100%;-webkit-mask-size:100% 100%;`;
 }
 return `<span class="portrait ${cls}" data-sprite="${key}" role="img" aria-label="${escape(p.name)}" style="--sprite-tail:${bounds?.tail||0};background-image:url('${replacement?.src||p.art}');background-size:${replacement?'100% 100%':'300% 200%'};background-position:${replacement?'center':`${col*50}% ${row*100}%`};${mask.replaceAll('"','&quot;')}"></span>`;
}
function sheetStyle(a,cols=2,rows=2){return `background-image:url('assets/story/${a.sheet}.png');background-size:${cols*100}% ${rows*100}%;background-position:${(a.cell%cols)/(cols-1)*100}% ${Math.floor(a.cell/cols)/(rows-1)*100}%`;}
function currentScene(){return D.stages[state.stage].scenes[state.scene];}
function cast(){return F.audience(state);}
function selectValid(){const c=cast();if(!c.includes(actor)||actor>=16)actor=c.find(p=>p<16)??0;if(!c.includes(target)||target===actor)target=c.find(p=>p!==actor)??null;}
function background(){let bg=currentScene().bg;if(state.phase==='gather'||state.phase==='board'||state.phase==='debrief'||state.phase==='checkpoint')bg=state.stage>=2?'buffet':currentScene().bg;if(dialogue?.bg)bg=dialogue.bg;return D.locations[bg];}
function render(){
 if(view==='title'){renderTitle();return;}stopTitleCycle();if(!state)return;
 $('#chapter-label').textContent=D.stages[state.stage].tag;
 if(state.phase==='ending'){renderEnding();return;}
 selectValid();const st=D.stages[state.stage],c=cast();
 const faces=dialogue?dialogueFaces():[actor,target].filter(Number.isInteger);
 app.innerHTML=`<div class="game"><section class="theater" aria-label="会話の場面"><div class="scene-bg" style="${sheetStyle(background())}"></div><div class="scene-meta"><span class="location">${escape(dialogue?.bg?sceneName(dialogue.bg):(state.phase==='free'?currentScene().name:state.phase==='intro'?currentScene().name:'会場・関係者の合流'))}</span><span class="scene-clock">${st.tag}</span></div><div class="cast-stage">${faces.map(id=>portrait(id,dialogue?.lines[dialogue.index]?.who===id?(dialogue.lines[dialogue.index].face||0):0,dialogue&&dialogue.lines[dialogue.index]?.who!==id?'dim':'')).join('')}</div>${dialogue?dialogueMarkup():`<div class="scene-note"><div class="eyebrow">${st.tag}</div><h2>${escape(st.title)}</h2><p>会話を選び、記録を比べ、あなた自身の推理を。</p></div>`}</section><section class="workspace" aria-label="調査と記録">${missionMarkup()}${renderWorkspace()}</section></div>`;
 updateGuide();requestAnimationFrame(fitCast);
 if(!dialogue&&state.phase==='free'&&tab==='talk')requestAnimationFrame(()=>{const el=$('.panel');if(el&&state.stage===0)el.scrollTop=0;});
}
// Align faces in stable slots. Extra torso stays behind the opaque text band.
function fitCast(){
 const theater=$('.theater'),stage=$('.cast-stage');if(!theater||!stage)return;
 const rect=theater.getBoundingClientRect(),box=$('.dialogue, .scene-note')?.getBoundingClientRect();
 const anchor=box?box.top-rect.top+8:rect.height;
 const topReserve=($('.scene-meta')?.getBoundingClientRect().bottom??rect.top)+8-rect.top;
 const sprites=[...stage.querySelectorAll('.portrait')];if(!sprites.length)return;
 const frames=sprites.map(e=>HisuiSpriteDisplay[e.dataset.sprite]);
 const slot=rect.width/sprites.length,padding=Math.max(6,rect.width*.012);
 const above=Math.max(...frames.map(f=>f.scale*(f.eye-f.bounds[1])));
 const below=Math.min(...frames.map(f=>f.scale*(f.bounds[3]-f.eye)));
 const horizontal=Math.min(...frames.map(f=>(slot/2-padding)/(f.scale*Math.max(f.cx-f.bounds[0],f.bounds[2]-f.cx))));
 const base=Math.max(1,Math.min(horizontal,(anchor-topReserve)/(above+below)));
 const eye=anchor-base*below;
 stage.style.top='0px';stage.style.bottom=(rect.height-anchor)+'px';
 sprites.forEach((sprite,i)=>{
  const f=frames[i],size=base*f.scale;
  Object.assign(sprite.style,{width:size+'px',height:size+'px',maxWidth:'none',margin:'0',
   left:((i+.5)*slot-f.cx*size)+'px',top:(eye-f.eye*size)+'px'});
 });
}
// Title slots fit complete silhouettes, keeping hands and hats inside the screen.
function fitTitleCast(){
 const cover=$('.title-cover:not(.title-mobile) .cover-art');if(!cover)return;
 const available=Math.max(1,cover.clientHeight-52-60);
 for(const group of document.querySelectorAll('.title-cast-group')){
  const slots=[...group.querySelectorAll('.title-person')];if(!slots.length)continue;
  const frames=slots.map(e=>HisuiSpriteDisplay[e.querySelector('.portrait').dataset.sprite]);
  const base=Math.min(...slots.map((e,i)=>{const f=frames[i],b=f.bounds;return Math.min(e.clientWidth/(b[2]-b[0]),available/(b[3]-b[1]))/f.scale}));
  slots.forEach((slot,i)=>{
   const f=frames[i],b=f.bounds,size=base*f.scale,sprite=slot.querySelector('.portrait');
   slot.style.height=((b[3]-b[1])*size)+'px';
   const left=Math.max(-b[0]*size,Math.min(slot.clientWidth-b[2]*size,slot.clientWidth/2-f.cx*size));
   Object.assign(sprite.style,{width:size+'px',height:size+'px',left:left+'px',top:(-b[1]*size)+'px'});
  });
 }
}
function faceSource(id){return `assets/story/ui/faces/${id}.png?v=3-framing`;}
function thumbnail(id){return `<span class="portrait person-thumbnail" role="img" aria-label="${escape(D.people[id].name)}" style="--sprite-tail:0;background-image:url('${faceSource(id)}');background-size:100% 100%;background-position:center"></span>`;}
function sceneName(bg){for(const s of D.stages.flatMap(x=>x.scenes))if(s.bg===bg)return s.name;return {room:'参加者の個室',gallery:'観賞用ギャラリー',empty:'紹介展示',buffet:'会場',corridor:'客用廊下',foyer:'受付'}[bg]||'館内';}
function phaseText(){if(state.phase==='checkpoint')return state.savedOK?'自動セーブ完了。この画面からなら安心して終了できます。':'保存できていません。ブラウザの保存容量・設定を確認してください。';if(dialogue)return '会話を読み進めてください。';if(state.phase==='board')return '根拠を選んで確認。間違えても何度でも考え直せます。';if(state.phase==='gather')return '重要情報を共有しました。検証する前に再質問もできます。';return state.stage===0?(state.acquired.includes('invite')?'記録を開き、案内を知らないユウキに共有しましょう。':'まずアオイからハヤトに展示の案内を聞きましょう。'):'会話は回数制限なし。記録はプレイヤーと人物の知識を区別します。';}
function guideContext(includeModal=true){return {state,tab,actor,target,dialogue,tutorial:tutorialGuide,talkStep,modal:includeModal&&$('#modal').open?guideModal:null};}
function missionMarkup(){
 const phase=HisuiGuide.phase(state,dialogue),g=HisuiGuide.next(guideContext(false));
 return `<section class="mission" aria-label="今すること"><ol class="phase-track" aria-label="章の進み方">${['調べる','合流','推理','章クリア'].map((name,i)=>`<li ${i===phase.index?'aria-current="step"':''} class="${i<phase.index?'done':''}"><span>${i<phase.index?'✓':i+1}</span>${name}</li>`).join('')}</ol><div class="guide-summary"><small>${escape(phase.label)}</small><button data-action="guide-help" class="quiet">操作の説明</button></div><div class="guide-next"><p id="guide-next-text" role="status" aria-live="polite">${escape(g?.text||phaseText())}</p><button data-action="guide-locate" class="quiet" aria-label="次に押す場所へ移動">押す場所へ</button></div></section>`;
}
function updateGuide(){
 updateNotice();
 document.querySelectorAll('.guide-target').forEach(e=>e.classList.remove('guide-target'));
 document.querySelectorAll('.guide-mark,.modal-guide').forEach(e=>e.remove());
 if(view!=='game'||!state||state.phase==='ending')return;
 const base=HisuiGuide.next(guideContext(false)),text=$('#guide-next-text');if(text&&base)text.textContent=base.text;
 const g=HisuiGuide.next(guideContext());if(!g)return;
 const el=$(g.selector);if(el){
  el.classList.add('guide-target');if(!el.matches('button,select,input')){el.setAttribute('role','group');el.setAttribute('aria-label',g.text);}const mark=document.createElement('span');mark.className='guide-mark';mark.textContent='次はここ';mark.setAttribute('aria-hidden','true');el.prepend(mark);
 }
 document.querySelectorAll('[data-action="guide-locate"]').forEach(button=>button.disabled=!el);
 if($('#modal').open){const note=document.createElement('div');note.className='modal-guide';note.setAttribute('role','status');note.innerHTML=`<p>${escape(g.text)}${g.note?' '+escape(g.note):''}</p><button data-action="guide-locate" class="quiet" ${el?'':'disabled'}>押す場所へ</button>`;$('#modal-body').prepend(note);}
}
function locateGuide(){
 const el=$('.guide-target');if(!el)return;
 const panel=el.closest('.panel,dialog');
 if(panel){const r=el.getBoundingClientRect(),p=panel.getBoundingClientRect(),head=panel.matches('dialog')?panel.querySelector('.modal-top').getBoundingClientRect().height:0;panel.scrollTop+=r.top-p.top-head-12;}
 if(!el.matches('button,select,input'))el.tabIndex=-1;
 el.focus({preventScroll:true});
}
function renderWorkspace(){
 if(dialogue)return `<div class="panel intro-panel"><span class="eyebrow">${dialogue.kind==='intro'?'STORY':'CONVERSATION'}</span><h2>${escape(D.stages[state.stage].title)}</h2><p>${dialogue.kind==='intro'?'人物たちの会話から、今の状況を見届けましょう。':'会話を聞いている人物に、話した情報が伝わります。'}</p><p class="status-line">${escape(dialogue.heard?.length?'聞いている人物：'+dialogue.heard.map(p=>D.people[p].name).join('・'):'「次へ」で続きを読み進めます。')}</p><button data-action="dialogue-next" class="primary">${dialogue.index===dialogue.lines.length-1?'会話を終える':'次へ'}</button><button data-action="back-log" class="quiet">この会話を読み返す</button></div>`;
 if(state.phase==='checkpoint')return `<div class="panel"><div class="checkpoint"><div class="eyebrow">CHECKPOINT ${String(state.stage).padStart(2,'0')}</div><h2>${escape(D.stages[state.stage].title)}</h2><p class="save-note" role="status">${state.savedOK?'保存済みです。タブを閉じて終了できます。':'保存に失敗しました。このまま閉じると進行を失います。'}</p>${!state.savedOK?'<button data-action="retry-save">保存を再試行</button>':''}<button data-action="next-stage" class="primary">${state.stage===7?'エピローグを見る':'次へ進む'}</button><button data-action="records-modal">記録を確認する</button><button data-action="recollections">補足会話・回想</button><button data-action="title">タイトルへ戻る</button><small>途中の章から遊び直しても、先の章の保存データは残ります。</small></div></div>`;
 if(state.phase==='intro')return '<div class="panel"><button data-action="begin-intro" class="primary">物語を読む</button></div>';
 return `<nav class="tabs" aria-label="調査メニュー">${[['talk','会話'],['records','記録'],['people','人物'],['board','推理']].map(([id,name])=>`<button data-tab="${id}" class="${tab===id?'active':''}" aria-selected="${tab===id}">${name}</button>`).join('')}</nav><div class="panel" id="work-panel">${tab==='talk'?talkPanel():tab==='records'?recordsPanel():tab==='people'?peoplePanel():boardPanel()}</div><footer class="footer-actions"><button data-action="hint" class="quiet">ヒント</button>${state.phase==='free'?`<button data-action="gather" class="primary">${F.ready(state)?state.stage===0?'展示へ向かう':state.stage===1?'夕食へ進む':'合流へ進む':'調査の進み具合'}</button>`:state.phase==='gather'?'<button data-action="begin-board" class="primary">ボードで考える</button>':'<button data-action="explain" class="primary">推理を伝える</button>'}</footer>`;
}
function talkPanel(){const st=F.stage(state),c=cast();const scenes=state.phase==='free'&&st.scenes.length>1?`<label class="field-label" for="scene">場面を切り替える</label><select id="scene" class="scene-picker">${st.scenes.map((s,i)=>`<option value="${i}" ${i===state.scene?'selected':''} ${state.stage===7&&i===1&&!state.acquired.includes('recovered')?'disabled':''}>${escape(s.name)}</option>`).join('')}</select>`:'';
 const qs=F.questions(state,actor,target);return `${scenes}<label class="field-label">① 質問する人</label><div class="chips guide-choice" data-guide="actors">${c.filter(p=>p<16).map(p=>`<button data-actor="${p}" class="${actor===p?'selected':''}" aria-pressed="${actor===p}">${escape(D.people[p].name)}</button>`).join('')}</div><label class="field-label">② 話す相手</label><div class="people-grid guide-choice" data-guide="targets">${c.filter(p=>p!==actor).map(p=>`<button data-target="${p}" class="person-card ${target===p?'selected':''}" aria-pressed="${target===p}">${thumbnail(p)}<span class="name">${escape(D.people[p].name)}</span></button>`).join('')}</div><label class="field-label">③ 話題</label><div class="talk-list guide-choice" data-guide="topics">${qs.length?qs.map(q=>`<button data-ask="${q.id}" ${q.locked?'disabled':''}>${q.locked?'未共有の情報が必要':escape(D.records[q.id].title)}<span>${q.locked?'質問内容は、情報を共有すると表示されます。':state.acquired.includes(q.id)?'記録済みの話を聞き直す':'新しい話を聞く'}</span></button>`).join(''):'<p class="hint-text">この人物とは、今の気持ちや試食会について話せます。</p>'}<button data-action="chat">少し話す<span>補足会話。重要情報や進行条件は変わりません。</span></button></div><p class="listening">聞こえる範囲：${c.map(p=>D.people[p].name).join('・')}</p>`;}
function recordCard(id){const r=D.records[id];const known=D.people.filter(p=>F.knows(state,p.id,id));return `<button class="record-card" data-record="${id}"><span class="eyebrow">${r.kind}</span><h3>${escape(r.title)}</h3><small>知っている人物：${known.map(p=>p.name).join('・')}</small></button>`;}
function recordsPanel(){return `<h3>プレイヤーの記録 ${state.acquired.length}</h3><p class="hint-text">閲覧しても人物の知識は増えません。情報を伝えるには、記録を開いて「伝える人」を選びます。</p><div class="record-list">${state.acquired.map(recordCard).join('')||'<p class="hint-text">会話をすると、ここに記録が残ります。</p>'}</div><button data-action="history" class="full quiet">会話と共有の履歴</button>`;}
function peoplePanel(){return `<h3>この場にいる人物</h3><div class="people-grid">${cast().map(p=>`<button class="person-card" data-person="${p}">${thumbnail(p)}<span class="name">${D.people[p].name}</span></button>`).join('')}</div><h3>参加者</h3><div class="chips">${D.people.slice(0,16).map(p=>`<button data-person="${p.id}">${p.name}</button>`).join('')}</div><p class="hint-text">人物を開くと、知っている情報と、まだ共有されていない記録を確認できます。</p>`;}
function boardPanel(){
 if(state.phase!=='board')return `<h3>時系列の記録</h3><p class="hint-text">関係者が合流して重要情報を共有した後、章のボードを検証できます。</p>${timelineEditor()}${timeline()}`;
 const st=F.stage(state);return `<p class="hint-text">① 根拠の記録を選ぶ → ② 結論を選ぶ → ③ 確認する。何度でも考え直せます。</p>${st.board.map(t=>{const b=state.board[t.id]||{proof:[],answer:''};return `<section class="board-task ${state.solved.includes(t.id)?'solved':''}" data-task="${t.id}"><h3>${state.solved.includes(t.id)?'✓ ':''}${escape(t.prompt)}</h3><div class="proof-options"><strong class="board-step">① 根拠の記録（複数選択できます）</strong>${state.acquired.map(id=>`<label><input type="checkbox" value="${id}" ${b.proof.includes(id)?'checked':''}>${escape(D.records[id].title)}</label>`).join('')}</div><div class="answer-field"><label class="field-label" for="answer-${t.id}">② 結論</label><select id="answer-${t.id}"><option value="">結論を選ぶ</option>${t.choices.map(c=>`<option ${b.answer===c?'selected':''}>${escape(c)}</option>`).join('')}</select></div><button data-check="${t.id}">この推理を確認</button><p class="board-feedback" role="status">${escape(feedback[t.id]|| (state.solved.includes(t.id)?t.conclusion:''))}</p></section>`;}).join('')}${state.stage===7?`<details><summary>人物ごとの確認済み／未確認</summary>${candidateTable()}</details>`:''}${timelineEditor()}${timeline()}`;
}
function timelineEditor(){const rows=state.timeline||{};const bands=['撮影前','撮影時点','撮影後・放送前','放送後','時点は未確認'];return `<details class="time-editor"><summary>任意の整理：時系列に記録を配置する</summary><p class="hint-text">あなたの整理用ボードです。配置しただけでは事実や人物の知識は変わりません。</p><label class="field-label" for="time-record">記録</label><select id="time-record" class="scene-picker">${state.acquired.map(id=>`<option value="${id}">${escape(D.records[id].title)}</option>`).join('')}</select><label class="field-label" for="time-band">置く位置</label><select id="time-band" class="scene-picker">${bands.map(b=>`<option>${b}</option>`).join('')}</select><button data-action="time-place">ここへ配置</button><div class="timeline">${bands.map(b=>`<div><strong>${b}</strong>${Object.keys(rows).filter(id=>rows[id]===b&&state.acquired.includes(id)).map(id=>`<button class="time-chip" data-record="${id}">${escape(D.records[id].title)}</button>`).join('')}</div>`).join('')}</div></details>`;}
function timeline(){return `<h3>確認した順序</h3><div class="timeline">${state.history.filter(h=>h.kind==='deduction'||h.kind==='gather').map(h=>`<div>${escape(h.text)}<small>${D.stages[h.stage].tag}</small></div>`).join('')||'<p class="hint-text">推理を確認すると、結論がここに並びます。</p>'}</div>`;}
function candidateTable(){const notes={0:'タクミとの会話を証言。前後の所在は未確認。',1:'道案内時は確認。散策全体は本人たちの説明。',2:'鍵を携帯。撮影後は会場へ戻ったと説明。',3:'レントと同じく、道案内以外の時間には空白。',4:'目撃と物音の証言。移動の全区間は未確認。',5:'食後に会場へ戻り、3人と会話。連続在席は別途確認が必要。',6:'会場の会話に参加。前後の行動を区別する。',7:'会場の会話に参加。目撃の範囲を超えて保証しない。',8:'写真とシンの証言。個室往復には空白。',9:'打ち合わせに参加。映像の範囲と離席を区別。',10:'会場の会話と食事メモ。手帳だけで所在を証明しない。',11:'打ち合わせに参加。映像と目撃の範囲を確認。',12:'点検中の所在は部分確認。工具の往復は単独。',13:'打ち合わせに参加。資料と映像を照合。',14:'二度の返却を確認。間の移動は未確認。',15:'撮影が継続。撮影者の所在は他者の証言も必要。',16:'退出・製作・物置での説明を証拠と照合。'};return D.people.map(p=>`<p><strong>${p.name}</strong><br>${notes[p.id]||'業務記録と目撃された時点を確認。勤務予定だけで除外しない。'}<br><small>未確認の行動を「不可能」とは判定しません。</small></p>`).join('');}
function dialogueFaces(){
 const l=dialogue.lines[dialogue.index],speakers=dialogue.lines.map(line=>line.who);
 const order=[...new Set([...speakers,dialogue.partner,...(dialogue.heard||[]),actor,target].filter(p=>Number.isInteger(p)&&D.people[p]))];
 // Prefer people in this conversation before filling a slot with a bystander.
 const candidates=[...new Set([l.who,dialogue.partner,...speakers,...order].filter(p=>Number.isInteger(p)&&D.people[p]))];
 return candidates.slice(0,2).sort((a,b)=>order.indexOf(a)-order.indexOf(b));
}
function dialogueMarkup(){const l=dialogue.lines[dialogue.index];return `<div class="dialogue"><div class="speaker">${l.who===null?'翡翠荘':escape(D.people[l.who]?.name||'')}</div><p class="speech" id="speech">${escape(l.text)}</p><div class="dialogue-controls"><span class="dialogue-progress">${dialogue.index+1} / ${dialogue.lines.length}</span><div><button data-action="dialogue-prev" ${dialogue.index===0?'disabled':''} aria-label="前の文章">戻る</button> <button data-action="dialogue-next" class="primary">${dialogue.index===dialogue.lines.length-1?'会話を終える':'次へ ▸'}</button></div></div></div>`;}
function paginate(lines){const limit=window.innerWidth<760?74:115;return lines.flatMap(l=>{const out=[];let rest=l.text;while(rest.length>limit){let at=-1;for(let i=Math.floor(limit*.55);i<limit;i++)if('。！？\n'.includes(rest[i]))at=i+1;if(at<1)at=limit;out.push({...l,text:rest.slice(0,at)});rest=rest.slice(at);}if(rest)out.push({...l,text:rest});return out;});}
function runDialogue(lines,done,{kind='talk',heard=[],partner=null,bg=null}={}){if(!lines.length){done();return;}dialogue={lines:paginate(lines),index:0,done,kind,heard,partner,bg,baseBg:bg};applyLine();render();}
function applyLine(){const l=dialogue.lines[dialogue.index];dialogue.bg=dialogue.lines.slice(0,dialogue.index+1).filter(x=>x.bg).at(-1)?.bg||dialogue.baseBg;if(l.text.includes('チャイム'))sound.play('announcement-chime',true);if(l.text.includes('返し忘れ'))sound.play('cutlery-return',true);}
function dialogueNext(){if(!dialogue)return;if(dialogue.index<dialogue.lines.length-1){dialogue.index++;applyLine();render();}else{const done=dialogue.done;dialogue=null;done();progress();render();}}
function beginIntro(){if(dialogue)return;const st=F.stage(state);runDialogue(state.stage===1?st.intro.slice(0,6):st.intro,()=>{state.phase='free';},{kind:'intro',bg:st.scenes[0].bg});}
function start(){tutorialGuide={actor:false,target:false};talkStep='actor';state=F.initial();view='game';tab='talk';actor=5;target=6;feedback={};sound.music('bgm-investigation');progress();render();beginIntro();}
function resume(entry){try{state=F.hydrate(entry.state);state.savedOK=true;view='game';tab='talk';dialogue=null;feedback={};talkStep='actor';closeModal();sound.music('bgm-investigation');render();}catch(e){toast(e.message);}}
// Visual quartets for the title, independent of chapter casts. No story evidence is shown.
const titleGroups=[[5,6,2,7],[0,13,15,8],[14,4,12,9],[1,10,11,3],[17,18,19,16],[20,21,22,5]];
const mobileTitleMedia=matchMedia('(max-width:760px), (max-width:1000px) and (max-height:500px) and (orientation:landscape)');
let titleTimer=null,titleGroup=0,titlePaused=false;
mobileTitleMedia.addEventListener('change',()=>{if(view==='title')renderTitle();});
function staticTitle(){return mobileTitleMedia.matches;}
function stopTitleCycle(){clearInterval(titleTimer);titleTimer=null;}
// Two figures on each side. Inner figures stay outside the central menu corridor.
const titleComposition=[
 [12,38,0,2,16,70], [25,26,0,4,25,46],
 [75,27,0,4,75,47], [88,39,0,2,84,71]
];
function titleGroupMarkup(ids){return `<div class="title-cast-figures poster-layout" style="--cast-count:${ids.length}">${ids.map((id,i)=>{const [x,size,lift,z,mx,ms]=titleComposition[i];return `<span class="title-person" data-cast="${id}" style="--x:${x}%;--size:${size}%;--cast-scale:${size/45};--lift:${lift}%;--depth:${z};--mobile-x:${mx}%;--mobile-size:${ms}%">${portrait(id)}</span>`;}).join('')}</div><div class="title-cast-names" style="--cast-count:${ids.length}">${ids.map((id,i)=>`<span class="title-name" data-name="${id}" style="--name-x:${titleComposition[i][0]}%;--mobile-name-x:${titleComposition[i][4]}%">${escape(D.people[id].name)}</span>`).join('')}</div>`;}

function nextTitleGroup(){
 if(staticTitle()||view!=='title'||!$('.title-cast')){stopTitleCycle();return;}
 if(document.hidden||$('#modal').open)return;
 titleGroup=(titleGroup+1)%titleGroups.length;
 const layers=[...document.querySelectorAll('.title-cast-group')],current=layers.find(e=>e.classList.contains('visible')),next=layers.find(e=>e!==current);
 next.innerHTML=titleGroupMarkup(titleGroups[titleGroup]);next.dataset.group=titleGroup;
 requestAnimationFrame(()=>{fitTitleCast();current.classList.remove('visible');next.classList.add('visible');});
}
function beginTitleCycle(){stopTitleCycle();if(!staticTitle()&&!titlePaused&&!matchMedia('(prefers-reduced-motion: reduce)').matches)titleTimer=setInterval(nextTitleGroup,6500);}
function titleEnsembleMarkup(){
 const card=p=>`<figure class="ensemble-person" data-person="${p.id}"><span class="ensemble-face" aria-hidden="true"><img src="${faceSource(p.id)}" alt="" width="192" height="192"></span><figcaption>${escape(p.name)}</figcaption></figure>`;
 return `<section class="title-ensemble" aria-label="登場人物23名">${[D.people.slice(0,12),D.people.slice(12)].map(people=>`<div class="ensemble-side">${people.map(card).join('')}</div>`).join('')}</section>`;
}
function renderTitle(){clearInterval(endingTimer);stopTitleCycle();titleGroup=0;$('#chapter-label').textContent='';sound.music('bgm-title');const recent=latest(),mobile=staticTitle();app.innerHTML=`<section class="cover title-cover ${mobile?'title-mobile':''}"><div class="cover-art">${mobile?'':`<div class="title-cast" aria-hidden="true"><div class="title-cast-group visible" data-group="0">${titleGroupMarkup(titleGroups[0])}</div><div class="title-cast-group" data-group="1"></div></div><button class="title-cycle-control quiet" data-action="title-cycle" aria-label="人物の自動切り替えを停止または再開">${titlePaused?'自動切替を再開':matchMedia('(prefers-reduced-motion: reduce)').matches?'人物を切り替える':'切替を止める'}</button><div class="cover-caption">甘い夜に、<br>ひとつの嘘。</div>`}</div><div class="cover-menu"><div class="title-logo"><div class="eyebrow">CASE 01 · SIXTEEN ENSEMBLE</div><h1 class="series-title"><span>シックスティーン・</span><span>アンサンブル</span><small>消えた至宝の謎</small></h1><div class="title-roman">SIXTEEN ENSEMBLE</div></div>${mobile?titleEnsembleMarkup():''}<div class="cover-buttons"><button data-action="continue" class="primary" ${recent?'':'disabled'}>つづきから${recent?`<small>${escape(D.stages[recent.id].title)} 終了時</small>`:''}</button><button data-action="new">はじめから</button><button data-action="chapters">章を選ぶ</button></div><span class="badge">音声は初期OFF ・ 章の区切りで自動保存</span></div></section>`;requestAnimationFrame(fitTitleCast);beginTitleCycle();}

function chapterMenu(){const slots=entries(),max=Math.max(-1,...slots.map(s=>s.id));modal('保存した区切りから再開',`<p>「章終了時」の状態から再開します。未到達の内容は表示しません。</p><div class="record-list">${D.stages.map((st,i)=>{const e=slots.find(s=>s.id===i);return `<button data-load="${i}" ${!e?'disabled':''}>${i<=max||e?escape(st.title):'？？？'}${e?`<small> ／ 終了時・${new Date(e.savedAt).toLocaleString('ja-JP')}</small>`:i<=max?' ／ 保存なし':''}</button>`;}).join('')}</div><p>以前の版の保存データは、この一覧とは別に保持しています。</p>`);}
function showRecord(id){
 if(!state.acquired.includes(id))return;const r=D.records[id],sharing=['free','gather','board'].includes(state.phase);
 const sources=cast().filter(p=>p<16&&F.knows(state,p,id)),can=sources.includes(actor),recipients=cast().filter(p=>!F.knows(state,p,id));
 modal(r.title,`${r.art?`<div class="record-art" role="img" aria-label="${escape(r.title)}" style="${sheetStyle(r.art,3,2)}"></div>`:''}<p class="record-body">${escape(r.text)}</p><h3>この情報を知っている人物</h3><div class="knowledge">${D.people.filter(p=>F.knows(state,p.id,id)).map(p=>`<span>${p.name}</span>`).join('')}</div>${sharing?`<div class="share-source-field"><label class="field-label" for="share-source">伝える人</label><select id="share-source"><option value="" disabled ${can?'':'selected'}>情報を知っている人を選ぶ</option>${sources.map(p=>`<option value="${p}" ${p===actor?'selected':''}>${D.people[p].name}</option>`).join('')}</select></div><p class="share-destination">伝える相手：この場の全員${recipients.length?`（新しく知る人：${recipients.map(p=>D.people[p].name).join('・')}）`:'（すでに共有済み）'}</p><button data-share="${id}" class="primary" ${can?'':'disabled'}>${can?D.people[actor].name+'から、この場の全員に伝える':'伝える人を選んでください'}</button>`:''}${F.challenges[id]&&sharing?`<button data-challenge="${id}" ${F.knows(state,actor,id)?'':'disabled'}>この説明を証拠と照合する</button>`:''}<p class="hint-text">読むだけでは人物には伝わりません。読むだけで戻るときは「閉じる」を押します。</p>`);
 guideModal={kind:'record',id};updateGuide();
}
function showPerson(id){const p=D.people[id],known=state.acquired.filter(r=>F.knows(state,id,r)),unknown=state.acquired.filter(r=>!F.knows(state,id,r));modal(p.name,`${thumbnail(id)}<p>${escape(p.profile)}</p><h3>知っている情報</h3><div class="record-list">${known.map(recordCard).join('')||'<p>プレイヤーの入手済み記録では、まだありません。</p>'}</div><h3>まだ共有されていない記録</h3><div class="record-list">${unknown.map(r=>`<button class="record-card" data-record="${r}">${escape(D.records[r].title)}</button>`).join('')||'<p>入手済みの情報は共有されています。</p>'}</div>`);}
function question(id){try{const {r,repeat,heard}=F.ask(state,actor,target,id);progress();sound.play('sfx-evidence');const cue={photo:['sfx-camera',false],routePhoto:['sfx-camera',false],sound:['metal-contact-distant',true],steps:['footsteps-receding',true],foundTool:['metal-contact-distant',true],recovered:['tray-setdown',true]};if(cue[id])sound.play(...cue[id]);let lines;if(id==='returnVideo'&&!repeat){lines=[D.line(15,'返却口も少し映ってる。ここを見て。'),D.line(14,'これだけ部屋に残ってて。返し忘れました。'),D.line(18,'ありがとうございます。かぼちゃグラタンはいかがでしたか？'),D.line(14,'えっ、食べたの分かるんですか？'),D.line(18,'先ほどのお皿がグラタン用でしたし、かぼちゃのソースも残っていましたので。'),D.line(14,'ああ、なるほど。美味しかったですよ。おかわりしようか迷ったくらい。')];}else{const opener=actor===3?'別の可能性も考えたい。':actor===1?'順に確認させて。':actor===5?'話せる範囲で、教えてもらえるかな。':actor===6?'決めつけずに確かめたいんだ。':actor===0?'事実を整理したい。':'確認してもいい？';lines=[D.line(actor,repeat?'もう一度、確認させて。':opener),D.line(target,repeat?shortRepeat(r):r.text)];}if(id==='invite'&&!repeat)lines.push(D.line(7,'初めまして、ユウキです。何の話をしていたの？'));runDialogue(lines,()=>{talkStep='actor';}, {heard,partner:actor,bg:currentScene().bg});}catch(e){toast(e.message);}}
function shortRepeat(r){const i=r.text.indexOf('。');return (i>=0?r.text.slice(0,i+1):r.text)+'詳しい内容は記録でも確認できるよ。';}
function casual(){const chat={1:'大胆な説も、条件が合うか確かめたいね。',3:'一番それらしい説明ほど、別の見方も試したくなる。',5:'少しずつなら、私も話せそう。',6:'急いで決めつけず、一人ずつ聞こう。',7:'同じスイーツを楽しみにしてたんだよね。',10:'味や香りは、忘れないうちに手帳に書くことにしている。',14:'待つだけより、確かめて動きたいんだ。',12:'……必要なら手伝う。まず、何を確かめるか決めよう。'};runDialogue([D.line(actor,'少し、話してもいい？'),D.line(target,chat[target]||'せっかく同じ会に招かれたんですから、落ち着いて話しましょう。')],()=>{talkStep='actor';}, {partner:actor,heard:cast()});}
function gather(){if(state.stage===1&&state.phase==='free'){F.gather(state);runDialogue(F.stage(state).intro.slice(6),()=>{F.checkpoint(state);state.savedOK=saveCheckpoint();render();},{kind:'intro',bg:'buffet'});return;}if(!F.ready(state)){modal('まだ確認できることがある',`<p>重要な会話や共有が残っています。任意の会話をすべて読む必要はありません。</p><button data-action="hint-more">人物や場所のヒントを見る</button>`);return;}F.gather(state);tab='talk';selectValid();const st=F.stage(state);if(state.stage===0){runDialogue(st.debrief,()=>{F.checkpoint(state);state.savedOK=saveCheckpoint();render();},{heard:cast()});return;}runDialogue([D.line(17,state.stage===3?'皆様で、確認できた行動と空白を整理しましょう。':state.stage===4?'映像とメニューを、一緒に確かめましょう。':'関係する皆様にお集まりいただきました。分かったことを共有しましょう。'),D.line(null,'それぞれが得た重要な証言と記録を、その場の全員で共有した。')],()=>{render();},{heard:cast(),bg:'buffet'});}
function hint(more=false){if(state.stage===0){modal('操作のヒント',`<p>${!state.acquired.includes('invite')?'「質問する人」でアオイ、「話す相手」でハヤトを選び、展示の案内を聞いてみましょう。':'「記録」で紹介展示の案内を開き、アオイから共有しましょう。後から加わるユウキにも案内が伝わります。'}</p>`);return;}let text='記録が示している範囲と、まだ分からない範囲を分けてみましょう。';const missing=F.missing(state);if(more&&missing.length){const r=D.records[missing[0]],scene=F.stage(state).scenes.find(s=>s.cast.includes(r.owner));text=`${D.people[r.owner].name}に、${scene?.name||'この場面'}で話を聞けます。質問が伏せられているときは、その話題に関係する情報を質問役へ共有しましょう。`;}else if(state.phase==='free')text='別の場面で、まだ話していない人物の記録も確かめてみましょう。';modal('考える方向',`<p>${escape(text)}</p>${!more&&missing.length?'<button data-action="hint-more">人物や場所のヒントを見る</button>':''}`);}
function explain(){const st=F.stage(state);if(!st.board.every(t=>state.solved.includes(t.id))){toast('章の重要な推理を、先に確認してください。');return;}modal('誰の言葉で伝えますか？',`<p>結論は共通です。必要な情報を知る、その場の参加者から選べます。</p><div class="chips">${cast().filter(p=>p<16).map(p=>`<button data-explain="${p}" ${st.board.every(t=>t.proof.every(id=>F.knows(state,p,id)))?'':'disabled'}>${D.people[p].name}</button>`).join('')}</div>`);guideModal={kind:'explain'};updateGuide();}
function finishExplain(id){try{F.complete(state,id);closeModal();const opener=id===3?'別の説明も検討した。今ある根拠から言えるのは、ここまでだ。':id===1?'資料が示す範囲を、順に確かめよう。':id===5?'集めたお話と記録を、照らし合わせてみました。':'記録を照合して、分かったことを伝えます。';const lines=[D.line(id,opener),...F.stage(state).board.map(t=>D.line(id,t.conclusion)),...F.stage(state).debrief];runDialogue(lines,()=>{F.checkpoint(state);state.savedOK=saveCheckpoint();sound.play('sfx-solved');render();},{heard:cast(),partner:null,bg:'buffet'});}catch(e){toast(e.message);}}
function leave(){if(view==='title')return;if(state.phase==='checkpoint'&&state.savedOK||state.phase==='ending'){goTitle();return;}modal('タイトルへ戻りますか？','<p>この章の進行は保存されません。最後に保存した区切りから再開できます。</p><button data-action="cancel-leave" class="primary">プレイを続ける</button> <button data-action="confirm-leave" class="danger">保存せずタイトルへ戻る</button>');}
function goTitle(){closeModal();dialogue=null;view='title';clearInterval(endingTimer);render();}
function recollections(){const history=state.history.filter(h=>h.stage===state.stage&&h.kind==='talk');modal('この区切りの回想',`<p>重要情報はすべて記録済みです。ここで見る補足会話では、人物の知識は変わりません。</p><details><summary>試食会への期待</summary><p>ユウキ「ひと口で誰かに話したくなるスイーツって、どんな味だろう」</p><p>ハヤト「その話を、一緒にできるといいね」</p></details><details><summary>友人同士の応酬</summary><p>ソウタ「可能性を増やすのは得意なんだけどね」</p><p>レント「だから、減らす条件を探すんだろう？」</p></details><details><summary>この章で確認した会話</summary>${history.map(h=>`<p>${escape(h.text)}</p>`).join('')||'<p>この区切りには聞き込みはありません。</p>'}</details>`);}
function renderEnding(){clearInterval(endingTimer);const total=20;const ads=endingIndex<4;const a=ads?{sheet:'ending/ending',cell:endingIndex}:{sheet:'ending/guests-'+(Math.floor((endingIndex-4)/4)+1),cell:(endingIndex-4)%4};app.innerHTML=`<div class="game"><section class="theater"><div class="ending-scene" style="${sheetStyle(a)}" role="img" aria-label="${ads?'数週間後に流れる至宝のモンブランの広告':D.people[endingIndex-4]?.name+'がチップスを食べる'}"></div><div class="ending-controls"><button data-action="ending-prev" ${endingIndex===0?'disabled':''}>前のカット</button><button data-action="ending-next" class="primary">${endingIndex===total-1?'スタッフロールへ':'次のカット'}</button></div></section><section class="workspace"><div class="panel credit"><span class="eyebrow">EPILOGUE</span><h2 style="font-family:serif;margin:20px 0">数週間後。</h2><p>街頭モニター、テレビ、SNS。<br>至宝のモンブランの広告は、<br>街のいたるところに流れていた。</p><p>そして、16人は――。</p><small>${endingIndex+1} / ${total}</small><p>セリフのないエピローグです。<br>カットは自動で進みます。</p><button data-action="ending-pause">自動送りを止める</button></div></section></div>`;if(!ads)sound.play('chips-crunch',true);endingTimer=setInterval(endingNext,3800);}
function endingNext(){if(endingIndex<19){endingIndex++;renderEnding();}else{clearInterval(endingTimer);state.endingSeen=true;app.innerHTML=`<section class="cover"><div class="cover-art"></div><div class="cover-menu"><span class="eyebrow">FIN</span><h1 class="series-title"><span>シックスティーン・</span><span>アンサンブル</span><small>消えた至宝の謎</small></h1><p>企画・物語：プレイヤーとの共同制作<br>イラスト：既存素材・追加生成素材<br>効果音：既存素材・オリジナル合成音</p><button data-action="title" class="primary">タイトルへ戻る</button><button data-action="chapters">章を選ぶ</button></div></section>`;sound.music('bgm-ending');}}
function help(){
 const g=view==='game'&&state?HisuiGuide.next(guideContext(false)):null;
 modal('操作ガイド',`${g?`<div class="help-now"><strong>今すること：${escape(g.text)}</strong><p>${escape(g.note)}</p><small>この章の目的：${escape(F.stage(state).goal)}</small></div>`:''}<ol class="help-steps"><li><strong>調べる</strong><p>① 質問する人 → ② 相手 → ③ 話題の順に選びます。本編の人物や話題は自由。回数制限はありません。</p></li><li><strong>記録を読む・伝える</strong><p>「記録」で聞いた内容を読み返せます。人物に伝えるときは記録を開き、情報を知る人から「この場の全員に伝える」を押します。</p></li><li><strong>合流する</strong><p>重要な情報が揃うと、案内が「合流へ進む」に変わります。合流すると重要情報をみんなで共有します。</p></li><li><strong>推理する</strong><p>根拠の記録を複数選び、結論を選んで「この推理を確認」。違っていても何度でもやり直せます。時系列への配置は任意の整理です。</p></li><li><strong>章クリア・保存</strong><p>推理を伝え、会話を読み終えると自動保存。「保存済み」と表示されたら終了できます。途中の進行は保存されません。</p></li></ol><p>太い枠と「次はここ」が操作の目印です。「押す場所へ」で目印まで移動できます。ほかの操作も使えます。</p><p>Tabで選択、Enterで決定。音は右上で切り替えられます。</p>`);
}
$('#help').onclick=help;$('#home').onclick=leave;$('#sound').onclick=()=>{sound.on=!sound.on;$('#sound').textContent=sound.on?'音 ON':'音 OFF';if(!sound.on){sound.bgm?.pause();sound.track='';}else{sound.track='';sound.music(view==='title'?'bgm-title':state?.phase==='ending'?'bgm-ending':'bgm-investigation');}};
document.addEventListener('click',e=>{const el=e.target.closest('button');if(!el||el.disabled)return;
 try{if(el.dataset.actor!==undefined){actor=Number(el.dataset.actor);tutorialGuide.actor=actor===5;talkStep='target';selectValid();render();return;}if(el.dataset.target!==undefined){target=Number(el.dataset.target);tutorialGuide.target=target===6;talkStep='topic';render();return;}if(el.dataset.tab){tab=el.dataset.tab;render();return;}if(el.dataset.ask){question(el.dataset.ask);return;}if(el.dataset.record){showRecord(el.dataset.record);return;}if(el.dataset.person!==undefined){showPerson(Number(el.dataset.person));return;}if(el.dataset.share){const n=F.share(state,actor,el.dataset.share);closeModal();progress();toast(n.length?`${n.map(p=>D.people[p].name).join('・')}に伝わりました。`:'この場の全員が既に知っています。');render();return;}if(el.dataset.check){const id=el.dataset.check,node=el.closest('.board-task'),proof=[...node.querySelectorAll('input:checked')].map(i=>i.value),answer=node.querySelector('select').value;const r=F.check(state,id,proof,answer);feedback[id]=r.message;if(r.ok){progress();sound.play('sfx-correction');}else sound.play('sfx-mismatch');const scroll=$('#work-panel').scrollTop;render();$('#work-panel').scrollTop=scroll;return;}if(el.dataset.challenge){const id=el.dataset.challenge;modal('この説明を確かめる',`<p>${escape(D.records[id].text)}</p><div id="challenge-proof">${state.acquired.map(r=>`<label class="proof-row"><input type="checkbox" value="${r}" ${F.knows(state,actor,r)?'':'disabled'}>${escape(D.records[r].title)}${F.knows(state,actor,r)?'':'（未共有）'}</label>`).join('')}</div><button data-confirm-challenge="${id}" class="primary">選んだ記録を示す</button><p id="challenge-result" role="status"></p>`);return;}if(el.dataset.confirmChallenge){const id=el.dataset.confirmChallenge,proof=[...$('#challenge-proof').querySelectorAll('input:checked')].map(i=>i.value),r=F.challenge(state,id,proof,actor);if(!r.ok){$('#challenge-result').textContent=r.message;return;}closeModal();progress();runDialogue([D.line(actor,'この記録と照らし合わせて、説明を確かめたい。'),D.line(actor,r.message)],()=>{}, {heard:cast(),partner:actor});return;}if(el.dataset.explain!==undefined){finishExplain(Number(el.dataset.explain));return;}if(el.dataset.load!==undefined){const en=entries().find(v=>v.id===Number(el.dataset.load));if(en)resume(en);return;}
 const action=el.dataset.action;if(!action)return;
 const actions={'guide-locate':locateGuide,'guide-help':help,'title-cycle':()=>{if(titleTimer){titlePaused=true;stopTitleCycle();el.textContent='自動切替を再開';}else{titlePaused=false;nextTitleGroup();beginTitleCycle();el.textContent=titleTimer?'切替を止める':'人物を切り替える';}},'time-place':()=>{const id=$('#time-record').value,band=$('#time-band').value;if(!state.acquired.includes(id))return;state.timeline=state.timeline||{};state.timeline[id]=band;progress();render();const el=$('.time-editor');if(el)el.open=true;},new:()=>{if(entries().length)modal('はじめから始める','<p>到着の場面から始めます。保存済みの各章は残ります。同じ区切りまで進むと、その区切りの保存が更新されます。</p><button data-action="confirm-new" class="primary">はじめから始める</button>');else start();},'confirm-new':()=>{closeModal();start();},continue:()=>{const en=latest();if(en)resume(en);},chapters:chapterMenu,title:leave,'confirm-leave':goTitle,'cancel-leave':closeModal,'dialogue-next':dialogueNext,'dialogue-prev':()=>{if(dialogue?.index){dialogue.index--;applyLine();render();}},'back-log':()=>modal('この会話',dialogue.lines.map(l=>`<p><strong>${l.who===null?'':D.people[l.who]?.name||''}</strong><br>${escape(l.text)}</p>`).join('')),'begin-intro':beginIntro,chat:casual,gather,'begin-board':()=>{F.beginBoard(state);tab='board';sound.music('bgm-deduction');render();},hint:()=>hint(false),'hint-more':()=>hint(true),explain,'next-stage':()=>{F.next(state);tab='talk';talkStep='actor';feedback={};dialogue=null;progress();if(state.phase==='ending'){endingIndex=0;sound.music('bgm-ending');render();}else{render();beginIntro();}},'retry-save':()=>{state.savedOK=saveCheckpoint();render();},'records-modal':()=>modal('入手済みの記録',`<div class="record-list">${state.acquired.map(recordCard).join('')}</div>`),recollections,history:()=>modal('会話と共有の履歴',state.history.slice().reverse().map(h=>`<p><small>${D.stages[h.stage].tag}・${h.order}</small><br>${escape(h.text)}</p>`).join('')),'ending-next':endingNext,'ending-prev':()=>{endingIndex=Math.max(0,endingIndex-1);renderEnding();},'ending-pause':()=>{clearInterval(endingTimer);el.textContent='次のカットはボタンで進められます。';el.disabled=true;}};
 actions[action]?.();
 }catch(err){toast(err.message);}
});
document.addEventListener('change',e=>{const task=e.target.closest('.board-task');if(task){state.board[task.dataset.task]={proof:[...task.querySelectorAll('input:checked')].map(i=>i.value),answer:task.querySelector('select').value};updateGuide();}if(e.target.id==='share-source'){const id=guideModal?.id;if(e.target.value!==''&&id){actor=Number(e.target.value);render();showRecord(id);}return;}if(e.target.id==='scene'){const i=Number(e.target.value);if(state.stage===7&&i===1&&!state.acquired.includes('recovered'))return;state.scene=i;talkStep='actor';selectValid();render();}});
window.addEventListener('beforeunload',e=>{if(view==='game'&&state&&state.phase!=='ending'&&!(state.phase==='checkpoint'&&state.savedOK)){e.preventDefault();e.returnValue='';}});
setInterval(()=>{const reading=dialogue||document.hidden||$('#modal').open||!['talk','board'].includes(tab);if(reading){lastProgress=Date.now();return;}if(view==='game'&&['free','board'].includes(state?.phase)&&!hintOffered&&Date.now()-lastProgress>120000){hintOffered=true;toast('少し視点を変えてみませんか？ 必要なら「ヒント」を開けます。');}},10000);
window.addEventListener('resize',()=>{if(view==='title')requestAnimationFrame(fitTitleCast);else if(!dialogue)render();else requestAnimationFrame(fitCast);});
document.fonts?.ready.then(()=>requestAnimationFrame(()=>{fitCast();fitTitleCast();}));
window.HisuiUI={get state(){return state;},get dialogue(){return dialogue;},get view(){return view;},get guide(){return state?HisuiGuide.next(guideContext()):null;}};
render();
