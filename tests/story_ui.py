"""Story-edition functional/UI checks. Start npm start before running."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/hisui-story-ui');OUT.mkdir(exist_ok=True)
BASE=os.environ.get('HISUI_TEST_URL','http://127.0.0.1:4175')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 results=[]
 for width,height in json.loads(os.environ.get('HISUI_VIEWPORTS','[[1366,768],[390,844],[844,390],[360,640],[320,568]]')):
  page=browser.new_page(viewport={'width':width,'height':height});errors=[];failed=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('response',lambda r:failed.append((r.status,r.url)) if r.status>=400 else None)
  page.on('dialog',lambda d:d.dismiss())
  page.goto(BASE);page.wait_for_timeout(100)
  def click(sel):page.locator(sel).first.click(timeout=8000)
  def fit(tag):
   assert page.evaluate('document.documentElement.scrollHeight<=innerHeight && document.documentElement.scrollWidth<=innerWidth'),tag+' page overflow'
   assert not errors,errors
   if page.locator('.speech').count():
    assert page.locator('.speech').evaluate('e=>e.clientHeight>=20'),tag+' collapsed speech'
   if page.locator('#work-panel').count():assert page.locator('#work-panel').evaluate('e=>e.clientHeight>=70'),tag+' collapsed panel'
  def dialogue():
   guard=0
   while page.evaluate('!!HisuiUI.dialogue'):
    fit('dialogue');click('[data-action="dialogue-next"]');guard+=1;assert guard<150
  def checkpoint():
   assert page.evaluate('HisuiUI.state.phase')=='checkpoint'
   assert page.locator('.save-note').inner_text().startswith('保存済み')
   fit('checkpoint')
  click('[data-action="new"]');dialogue();fit('tutorial')
  click('[data-ask="invite"]');dialogue()
  assert not page.evaluate('HisuiFlow.knows(HisuiUI.state,7,"invite")')
  click('[data-tab="records"]');click('[data-record="invite"]');click('[data-share="invite"]')
  assert page.evaluate('HisuiFlow.knows(HisuiUI.state,7,"invite")')
  click('[data-action="gather"]');dialogue();checkpoint()
  page.screenshot(path=str(OUT/f'{width}x{height}-checkpoint.png'))
  # Save/resume and title without losing existing slots.
  click('[data-action="title"]');click('[data-action="continue"]');checkpoint()
  for stage in range(1,8):
   click('[data-action="next-stage"]');dialogue()
   if stage==1:
    click('[data-action="gather"]');dialogue();checkpoint();continue
   fit('chapter intro')
   ids=page.evaluate('HisuiFlow.stage(HisuiUI.state).required')
   pending=list(ids);guard=0
   while pending:
    guard+=1;assert guard<60,pending
    changed=False
    for rid in pending[:]:
     plan=page.evaluate('''id=>{const s=HisuiUI.state,r=HisuiStory.records[id];for(let i=0;i<HisuiFlow.stage(s).scenes.length;i++){const c=HisuiFlow.stage(s).scenes[i].cast;if(!c.includes(r.owner))continue;if(s.stage===7&&i===1&&!s.acquired.includes('recovered'))continue;const a=c.find(p=>p<16&&p!==r.owner&&r.req.every(q=>HisuiFlow.knows(s,p,q)));if(a!==undefined)return {scene:i,actor:a,target:r.owner};}return null}''',rid)
     if not plan:continue
     click('[data-tab="talk"]')
     if page.locator('#scene').count():page.locator('#scene').select_option(str(plan['scene']))
     click(f'[data-actor="{plan["actor"]}"]');click(f'[data-target="{plan["target"]}"]');click(f'[data-ask="{rid}"]');dialogue();pending.remove(rid);changed=True
    assert changed,pending
   if stage==4:
    click('[data-tab="records"]');click('[data-record="fork"]');click('[data-challenge="fork"]')
    page.locator('#challenge-proof input[value="menu"]').check();click('[data-confirm-challenge="fork"]')
    assert page.locator('#challenge-result').inner_text()
    page.locator('#challenge-proof input[value="returnVideo"]').check();click('[data-confirm-challenge="fork"]');dialogue()
   # records -> person -> record: both knowledge views must be reachable.
   click('[data-tab="people"]');click('[data-person]').__class__ if False else None
   page.locator('[data-person]').first.click();assert page.locator('#modal-body').inner_text();click('#close-modal')
   click('[data-tab="talk"]');click('[data-action="gather"]');dialogue();click('[data-action="begin-board"]');fit('board')
   if stage==2:
    page.locator('.time-editor summary').click()
    page.locator('#time-record').select_option('photo')
    page.locator('#time-band').select_option(label='撮影時点')
    click('[data-action="time-place"]')
    assert page.evaluate('HisuiUI.state.timeline.photo')=='撮影時点'
   tasks=page.evaluate('HisuiFlow.stage(HisuiUI.state).board')
   for t in tasks:
    section=page.locator('[data-task="'+t['id']+'"]')
    # Wrong proof keeps player in the board without losing evidence.
    section.locator('select').select_option(label=t['answer']);section.locator('[data-check]').click()
    assert page.evaluate('HisuiUI.state.phase')=='board'
    section=page.locator('[data-task="'+t['id']+'"]')
    for rid in t['proof']:section.locator('input[value="'+rid+'"]').check()
    section.locator('select').select_option(label=t['answer']);section.locator('[data-check]').click()
    assert page.locator('[data-task="'+t['id']+'"].solved').count()
   page.screenshot(path=str(OUT/f'{width}x{height}-chapter{stage-1}.png'))
   click('[data-action="explain"]');page.locator('[data-explain]:not([disabled])').first.click();dialogue();checkpoint()
  assert page.evaluate('Object.keys(JSON.parse(localStorage.getItem("hisui.chapter-checkpoints.v3")).slots).length')==8
  click('[data-action="next-stage"]');click('[data-action="ending-pause"]');fit('ending')
  for i in range(20):click('[data-action="ending-next"]')
  assert page.get_by_text('FIN',exact=True).count()
  click('[data-action="title"]');click('[data-action="chapters"]');assert page.locator('[data-load]:not([disabled])').count()==8
  fit('chapter menu');assert not failed,failed
  results.append({'viewport':[width,height],'errors':errors,'failedAssets':failed,'completeRoute':True})
  page.close()
 browser.close();(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print(json.dumps(results,ensure_ascii=False))
