"""Wide-screen pane coverage, cast scale and reading/control geometry regression."""
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/hisui-wide-ui');OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);results=[]
 for w,h in [(1366,768),(1600,900),(1920,911),(1920,1080),(2560,1080),(3440,1440),(390,844),(844,390)]:
  page=b.new_page(viewport={'width':w,'height':h},reduced_motion='reduce');errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.dismiss())
  page.goto('http://127.0.0.1:4175',wait_until='networkidle');page.locator('[data-action="new"]').click();page.wait_for_timeout(40)
  def fit(label):
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),(w,h,label,'page overflow')
   assert page.evaluate('''()=>{const a=document.querySelector('#app').getBoundingClientRect(),t=document.querySelector('.theater').getBoundingClientRect(),s=document.querySelector('.workspace').getBoundingClientRect();return Math.abs(s.right-a.right)<1&&Math.abs(s.bottom-a.bottom)<1&&(t.right<=s.left+1||t.bottom<=s.top+1);}'''),(w,h,label,'unfilled grid')
   if page.locator('#work-panel').count():assert page.locator('#work-panel').evaluate('e=>e.clientHeight>=70'),(w,h,label,'collapsed panel')
   if page.locator('.dialogue').count():
    assert page.locator('.speech').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),(w,h,label,'speech overflow')
    assert page.evaluate('''()=>{const t=document.querySelector('.theater').getBoundingClientRect();return [...document.querySelectorAll('.dialogue-controls button')].every(e=>{const r=e.getBoundingClientRect();return r.left>=t.left&&r.right<=t.right&&r.top>=t.top&&r.bottom<=t.bottom});}'''),(w,h,label,'off-screen dialogue controls')
   assert page.evaluate('''()=>{const t=document.querySelector('.theater').getBoundingClientRect();return [...document.querySelectorAll('.cast-stage .portrait')].every(e=>{const r=e.getBoundingClientRect();return r.left>=t.left-1&&r.right<=t.right+1;});}'''),(w,h,label,'cropped sprite edge')
   assert not errors,errors
  fit('conversation')
  size=page.locator('.cast-stage .portrait').first.bounding_box()['width']
  if w>=1600:assert size>=500,(w,h,'small cast',size)
  if w>=1600:assert page.locator('.speech').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)>=19')
  page.screenshot(path=str(OUT/f'{w}x{h}-conversation.png'))
  for text in ['はい。','改行と折り返しを確認します。\n'+('会話の文章が長くなっても画面の外へはみ出しません。'*6)]:
   page.locator('#speech').evaluate('(e,text)=>e.textContent=text',text);page.evaluate('fitCast()');fit('long and short text')
   assert page.locator('#speech').evaluate('e=>getComputedStyle(e).whiteSpace')=='pre-wrap'
  page.evaluate('render()')
  while page.evaluate('!!HisuiUI.dialogue'):page.locator('[data-action="dialogue-next"]').first.click()
  for tab in ['talk','records','people','board']:
   page.locator(f'[data-tab="{tab}"]').click();fit(tab)
  # Legitimate engine operations create a populated board and saved checkpoint.
  page.evaluate('''()=>{F.ask(state,5,6,'invite');F.share(state,5,'invite');F.gather(state);F.checkpoint(state);F.next(state);F.checkpoint(state);F.next(state);state.phase='free';let pending=new Set(F.stage(state).required);for(let guard=0;pending.size&&guard<20;guard++){for(const id of [...pending]){const r=D.records[id];for(const [i,scene] of F.stage(state).scenes.entries()){if(!scene.cast.includes(r.owner))continue;state.scene=i;const a=F.audience(state).find(p=>p<16&&p!==r.owner&&r.req.every(q=>F.knows(state,p,q)));if(a===undefined)continue;F.ask(state,a,r.owner,id);pending.delete(id);break;}}}if(pending.size)throw Error('Unreachable records');F.gather(state);F.beginBoard(state);tab='board';render();}''')
  fit('populated board');page.screenshot(path=str(OUT/f'{w}x{h}-board.png'))
  page.evaluate('''()=>{for(const t of F.stage(state).board)F.check(state,t.id,t.proof,t.answer);F.complete(state,F.audience(state).find(p=>p<16));F.checkpoint(state);state.savedOK=saveCheckpoint();render();}''')
  fit('checkpoint');page.screenshot(path=str(OUT/f'{w}x{h}-checkpoint.png'))
  page.locator('#help').click();assert page.locator('#modal').evaluate('e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}')
  page.locator('#close-modal').click()
  # Exercise the epilogue component in isolation; story progression is covered by story_ui.py.
  page.evaluate("state.phase='ending';endingIndex=0;render();clearInterval(endingTimer)");fit('ending')
  results.append({'viewport':[w,h],'portraitWidth':round(size,1),'allViewsFit':True});page.close()
 b.close()
 print(results)
