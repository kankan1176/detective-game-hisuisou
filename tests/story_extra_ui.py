from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844});page.on('dialog',lambda d:d.dismiss());page.goto('http://127.0.0.1:4175')
 def click(s):page.locator(s).first.click()
 def read():
  while page.evaluate('!!HisuiUI.dialogue'):click('[data-action="dialogue-next"]')
 # Create legitimate checkpoint snapshots via the engine to test storage navigation.
 page.evaluate('''()=>{let s=HisuiFlow.initial();s.phase='free';HisuiFlow.ask(s,5,6,'invite');HisuiFlow.share(s,5,'invite');HisuiFlow.gather(s);HisuiFlow.checkpoint(s);const a=HisuiFlow.copy(s);HisuiFlow.next(s);HisuiFlow.checkpoint(s);localStorage.setItem('hisui.chapter-checkpoints.v3',JSON.stringify({slots:{0:{state:a,savedAt:10},1:{state:s,savedAt:20}}}));}''')
 page.reload();click('[data-action="chapters"]');assert page.locator('[data-load="2"]').inner_text()=='？？？';click('#close-modal')
 click('[data-action="continue"]');assert page.evaluate('HisuiUI.state.stage')==1
 click('[data-action="next-stage"]');read();assert page.evaluate('HisuiUI.state.stage')==2
 click('[data-target="2"]');assert page.locator('[data-ask="fixed"]').is_disabled()
 before=page.evaluate('JSON.stringify(HisuiUI.state)');click('#home');assert '保存されません' in page.locator('#modal-body').inner_text();click('[data-action="cancel-leave"]');assert page.evaluate('JSON.stringify(HisuiUI.state)')==before
 click('[data-target="8"]');click('[data-ask="photo"]');read();click('[data-target="2"]');assert page.locator('[data-ask="fixed"]').is_enabled()
 # Quota/storage failure must not claim that progress was saved.
 click('#home');click('[data-action="confirm-leave"]');click('[data-action="new"]');click('[data-action="confirm-new"]');read()
 click('[data-ask="invite"]');read();click('[data-tab="records"]');click('[data-record="invite"]');click('[data-share="invite"]')
 page.evaluate("()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError')}}")
 click('[data-action="gather"]');read();assert page.evaluate('HisuiUI.state.phase')=='checkpoint';assert not page.evaluate('HisuiUI.state.savedOK');assert '保存でき' in page.locator('.mission p').inner_text();assert page.locator('[data-action="retry-save"]').count()
 # The preexisting two checkpoint slots remain intact after the failed write.
 assert page.evaluate('Object.keys(JSON.parse(localStorage.getItem("hisui.chapter-checkpoints.v3")).slots).length')==2
 b.close();print('PASS extra UI: hidden chapters, latest checkpoint, locked questions, cancel leave, quota failure and retained saves')
