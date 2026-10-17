"""Visible silhouettes, shared eye lines and stable conversation positions."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 checked=0
 for w,h in [(1920,911),(2560,1080),(3440,1440),(390,844),(844,390)]:
  page=browser.new_page(viewport={'width':w,'height':h},reduced_motion='reduce')
  page.goto('http://127.0.0.1:4175',wait_until='networkidle')
  page.locator('[data-action="new"]').click()
  page.evaluate('()=>new Promise(r=>requestAnimationFrame(r))')
  cases=page.evaluate('''()=>{const out=[],stage=document.querySelector('.cast-stage'),t=document.querySelector('.theater').getBoundingClientRect();
   for(const person of D.people)for(let face=0;face<(person.row===null?6:3);face++){
    const other=person.id===17?5:17;stage.innerHTML=portrait(person.id,face)+portrait(other);fitCast();
    const frames=[...stage.children].map((e,i)=>{const r=e.getBoundingClientRect(),f=HisuiSpriteDisplay[e.dataset.sprite];
     return {key:e.dataset.sprite,ratio:r.width/r.height,eye:r.top+f.eye*r.height,
      left:r.left+f.bounds[0]*r.width,right:r.left+f.bounds[2]*r.width,
      slotLeft:t.left+i*t.width/2,slotRight:t.left+(i+1)*t.width/2};});out.push(frames);
   }return out;}''')
  for pair in cases:
   assert abs(pair[0]['eye']-pair[1]['eye'])<.1,(w,h,pair)
   for frame in pair:
    assert abs(frame['ratio']-1)<.001,(w,h,frame)
    assert frame['left']>=frame['slotLeft'] and frame['right']<=frame['slotRight'],(w,h,frame)
   checked+=1
  # Alternating speakers must not exchange places, including generated poses.
  page.evaluate("runDialogue([{who:7,face:3,text:'確認します。'},{who:17,face:0,text:'はい。'},{who:7,face:0,text:'ありがとう。'}],()=>{},{partner:17})")
  positions=[]
  for i in range(3):
   page.evaluate('()=>new Promise(r=>requestAnimationFrame(r))')
   positions.append(page.locator('.cast-stage .portrait').evaluate_all('es=>es.map(e=>Number(e.dataset.sprite.split(":")[0]))'))
   if i<2:page.locator('[data-action="dialogue-next"]').first.click()
  assert positions==[[7,17]]*3,(w,h,positions)
  page.close()
 browser.close()
print(f'PASS cast framing: {checked} expression/pair checks; uniform aspect, separate slots, equal eye lines and stable speaker positions')
