"""Follow the visible guide, including off-screen controls and manual knowledge sharing."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(os.environ.get('HISUI_GUIDE_ARTIFACTS','/tmp/hisui-guide-ui'));OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);results=[]
 for w,h in [(1920,911),(2560,1080),(390,844),(320,568),(360,640),(844,390),(568,320),(768,1024)]:
  page=browser.new_page(viewport={'width':w,'height':h},reduced_motion='reduce');errors=[];failed=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
  page.on('dialog',lambda d:d.dismiss());page.goto('http://127.0.0.1:4175',wait_until='networkidle')
  page.locator('[data-action="new"]').click()
  def fit():
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),(w,h,'page overflow')
   assert not errors and not failed,(errors,failed)
   assert page.locator('.guide-target').count()==1,(w,h,'missing/duplicate target')
   assert page.locator('.guide-mark').count()==1
  def step(expected,press=True):
   assert page.evaluate('HisuiUI.guide.id')==expected,(w,h,expected,page.evaluate('HisuiUI.guide'))
   fit()
   root=page.locator('#modal') if page.locator('#modal').evaluate('e=>e.open') else page.locator('.mission')
   root.locator('[data-action="guide-locate"]').click()
   # The actual marker must be visible inside its scrolling pane, not merely in the DOM.
   assert page.locator('.guide-mark').evaluate('''e=>{const r=e.getBoundingClientRect(),p=e.closest('dialog,.panel'),b=p?.getBoundingClientRect(),header=p?.matches('dialog')?p.querySelector('.modal-top').getBoundingClientRect().bottom:0;return r.top>=Math.max(0,b?.top||0,header)-1&&r.bottom<=Math.min(innerHeight,b?.bottom||innerHeight)+1}'''),(w,h,expected,'marker remains off screen')
   if press:page.locator('.guide-target').click()
  def read():
   while page.evaluate('!!HisuiUI.dialogue'):step('read')
  read();step('tutorial-actor');step('tutorial-target');step('tutorial-topic');read()
  step('tutorial-records');step('tutorial-record',False)
  page.screenshot(path=str(OUT/f'{w}x{h}-record-step.png'))
  page.locator('.guide-target').click()
  assert not page.evaluate('F.knows(state,7,"invite")')
  assert 'ユウキ' in page.locator('.share-destination').inner_text()
  step('share',False)
  page.keyboard.press('Escape');page.wait_for_function('!document.querySelector("#modal").open')
  assert page.evaluate('HisuiUI.guide.id')=='tutorial-record'
  # A person who lacks the record cannot share it; reading and choosing a source do not share.
  page.locator('[data-tab="talk"]').click();page.locator('[data-actor="7"]').click()
  page.locator('[data-tab="records"]').click();step('tutorial-record')
  step('share-source',False)
  assert page.locator('[data-share="invite"]').is_disabled()
  assert page.locator('#share-source option:not([disabled])').evaluate_all('es=>es.map(e=>e.value)')==['5','6']
  page.locator('#share-source').select_option('5')
  assert not page.evaluate('F.knows(state,7,"invite")')
  step('share');assert page.evaluate('F.knows(state,7,"invite")')
  assert not page.locator('#toast').evaluate('e=>e.classList.contains("show")'),'notification must not cover controls'
  assert page.locator('.operation-notice').count()==1
  step('tutorial-gather');read();step('next-chapter');read();step('gather');read();step('next-chapter');read()
  assert page.locator('.phase-track [aria-current]').inner_text().endswith('調べる')
  assert page.locator('[data-tab]').count()==4
  step('actor',False)
  page.locator('[data-actor="7"]').click();step('target',False)
  page.locator('[data-target="8"]').click();step('topic',False)
  # The guide highlights the entire choice group; it does not choose a person or topic.
  assert page.locator('.guide-target').get_attribute('data-guide')=='topics'
  page.locator('[data-ask="photo"]').click();read()
  for rid in ['discovery','fixed']:
   page.locator('[data-actor="5"]').click();page.locator('[data-target="2"]').click()
   page.locator(f'[data-ask="{rid}"]').click();read()
  step('gather');read();step('begin-board')
  assert page.locator('.phase-track [aria-current]').inner_text().endswith('推理')
  step('proof',False)
  assert page.locator('.board-task').first.evaluate('e=>e.getBoundingClientRect().top<document.querySelector(".time-editor").getBoundingClientRect().top')
  page.locator('.board-task input[value="invite"]').check();step('answer',False)
  task=page.evaluate('F.stage(state).board[0]')
  page.locator('.board-task select').select_option(label=next(c for c in task['choices'] if c!=task['answer']))
  step('check');assert page.evaluate('state.phase')=='board' and not page.evaluate('state.solved.length')
  for rid in task['proof']:page.locator(f'.board-task input[value="{rid}"]').check()
  page.locator('.board-task select').select_option(label=task['answer']);step('check')
  step('explain');step('speaker',False)
  page.locator('[data-explain="5"]').click();read()
  assert page.locator('.save-note').inner_text().startswith('保存済み')
  assert page.evaluate('HisuiUI.guide.id')=='next-chapter'
  page.screenshot(path=str(OUT/f'{w}x{h}-saved.png'))
  page.locator('[data-action="title"]').click();page.locator('[data-action="continue"]').click()
  assert page.evaluate('state.stage')==2 and page.evaluate('HisuiUI.guide.id')=='next-chapter'
  fit();results.append({'viewport':[w,h],'guidedTutorial':True,'manualSharing':True,'freeChoices':True,'boardRecovery':True,'saveResume':True,'errors':errors,'failedAssets':failed});page.close()
 browser.close();(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print(json.dumps(results,ensure_ascii=False))
