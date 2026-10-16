"""Desktop quartets and static 23-person phone title regression."""
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/hisui-title-cast');OUT.mkdir(exist_ok=True)
BASE='http://127.0.0.1:4175'

def fit(page):
 assert page.evaluate('document.documentElement.scrollHeight<=innerHeight && document.documentElement.scrollWidth<=innerWidth')
 assert page.locator('[data-action="chapters"]').inner_text()=='章を選ぶ'

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 # Desktop: equally sized quartets, central menu, names and painted bottoms.
 for w,h in [(1366,768),(1024,768),(768,1024)]:
  page=b.new_page(viewport={'width':w,'height':h});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE,wait_until='networkidle')
  assert page.locator('.title-cast-group.visible .portrait').count()==4
  page.locator('[data-action="title-cycle"]').click();assert page.evaluate('titleTimer===null')
  page.emulate_media(reduced_motion='reduce')
  for i in range(6):
   if i:page.evaluate('nextTitleGroup()');page.wait_for_timeout(40)
   assert page.locator('.title-cast-group.visible').get_attribute('data-group')==str(i)
   assert page.locator('.ensemble-panels').count()==0
   ids=page.locator('.title-cast-group.visible .title-person').evaluate_all('es=>es.map(e=>e.dataset.cast)')
   labels=page.locator('.title-cast-group.visible .title-name').evaluate_all('es=>es.map(e=>e.dataset.name)')
   assert len(ids)==4 and ids==labels
   sizes=page.locator('.title-cast-group.visible .title-person').evaluate_all('es=>es.map(e=>e.getBoundingClientRect().width)')
   assert max(sizes)-min(sizes)<1,(w,h,i,sizes)
   assert page.evaluate('''()=>{const m=document.querySelector('.cover-buttons').getBoundingClientRect();return [...document.querySelectorAll('.title-cast-group.visible .title-person')].every(e=>{const r=e.getBoundingClientRect();return r.right<=m.left+1||r.left>=m.right-1||r.top>=m.bottom||r.bottom<=m.top;});}'''),(w,h,i,'figure obscures menu')
   assert all(page.locator('.title-cast-group.visible .title-person').evaluate_all('es=>es.map(e=>{const r=e.getBoundingClientRect(),p=e.closest(".cover-art").getBoundingClientRect();return r.x+r.width*.3>=p.x&&r.x+r.width*.7<=p.right&&r.y>=p.y+20})'))
   bottoms=page.locator('.title-cast-group.visible .portrait').evaluate_all('es=>es.map(e=>{const r=e.getBoundingClientRect(),p=e.closest(".cover-art").getBoundingClientRect(),tail=Number(getComputedStyle(e).getPropertyValue("--sprite-tail"));return r.bottom-tail*r.height-p.bottom})')
   assert all(abs(n)<1 for n in bottoms)
   fit(page)
  page.emulate_media(reduced_motion='no-preference')
  page.locator('[data-action="title-cycle"]').click();assert page.evaluate('titleTimer!==null')
  page.locator('[data-action="new"]').click();assert page.evaluate('titleTimer===null')
  assert page.locator('.dialogue').count() and not errors
  page.close()
 # Phone: everyone appears immediately; nothing cycles; no full atlases are downloaded.
 for w,h in [(390,844),(360,640),(320,568),(430,932),(844,390),(568,320),(480,320),(320,480)]:
  page=b.new_page(viewport={'width':w,'height':h});errors=[];failed=[];resources=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('response',lambda r:resources.append(r.url))
  page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
  page.clock.install();page.goto(BASE,wait_until='networkidle');page.evaluate('document.fonts.ready')
  assert page.locator('.ensemble-person').count()==23
  assert not page.locator('.title-cycle-control').count() and page.evaluate('titleTimer===null')
  ids=page.locator('.ensemble-person').evaluate_all('es=>es.map(e=>Number(e.dataset.person))')
  assert ids==list(range(23))
  assert page.locator('.ensemble-person figcaption').all_text_contents()==page.evaluate('D.people.map(p=>p.name)')
  assert page.locator('.ensemble-face img').evaluate_all('es=>es.every(e=>e.complete&&e.naturalWidth===192&&e.naturalHeight===192)')
  assert not any('-atlas.png' in url or '/story/characters/' in url for url in resources),resources
  # Every portrait and every name stays within the screen, outside the logo/menu.
  assert page.evaluate('''()=>{const reserved=['.title-logo','.cover-buttons'].map(s=>document.querySelector(s).getBoundingClientRect());return [...document.querySelectorAll('.ensemble-face,.ensemble-person figcaption')].every(e=>{const r=e.getBoundingClientRect();return r.width>=15&&r.height>0&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&e.scrollWidth<=e.clientWidth+1&&reserved.every(m=>r.right<=m.left+1||r.left>=m.right-1||r.top>=m.bottom||r.bottom<=m.top);});}'''),(w,h,'portrait/name overlaps or overflows')
  assert page.evaluate('''()=>{const r=document.querySelector('.cover-buttons').getBoundingClientRect();return Math.abs(r.left+r.width/2-innerWidth/2)<1;}''')
  page.clock.fast_forward(20000);page.clock.run_for(50)
  assert page.evaluate('titleTimer===null')
  assert page.locator('.ensemble-person').evaluate_all('es=>es.map(e=>Number(e.dataset.person))')==ids
  fit(page);page.screenshot(path=str(OUT/f'{w}x{h}-static.png'))
  page.locator('[data-action="chapters"]').click();assert page.locator('#modal').evaluate('e=>e.open')
  page.locator('#close-modal').click();page.locator('[data-action="new"]').click();assert page.locator('.dialogue').count()
  assert not errors and not failed,(errors,failed)
  page.close()
 # Resize/orientation changes must stop/restart desktop cycling without stale layers.
 page=b.new_page(viewport={'width':1366,'height':768});page.clock.install();page.goto(BASE)
 page.clock.fast_forward(6600);page.clock.run_for(50)
 assert page.locator('.title-cast-group.visible').get_attribute('data-group')=='1'
 page.set_viewport_size({'width':390,'height':844});page.wait_for_function('document.querySelectorAll(".ensemble-person").length===23');page.clock.run_for(100)
 assert page.locator('.ensemble-person').count()==23 and page.evaluate('titleTimer===null')
 page.set_viewport_size({'width':844,'height':390});page.clock.run_for(100)
 assert page.locator('.ensemble-person').count()==23 and page.evaluate('titleTimer===null')
 page.set_viewport_size({'width':1366,'height':768});page.wait_for_function('document.querySelectorAll(".title-cast-group.visible .portrait").length===4&&titleTimer!==null');page.clock.run_for(100)
 assert page.locator('.title-cast-group.visible .portrait').count()==4 and page.evaluate('titleTimer!==null')
 page.close()
 page=b.new_page(reduced_motion='reduce');page.goto(BASE);assert page.evaluate('titleTimer===null')
 page.locator('[data-action="title-cycle"]').click();page.wait_for_timeout(50)
 assert page.locator('.title-cast-group.visible').get_attribute('data-group')=='1'
 b.close()
print('PASS title: equal desktop quartets; 23 static phone portraits at 8 sizes; no atlas downloads; cycle/pause, resize, reduced motion and game entry')
