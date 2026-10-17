"""Geometry and matte-rendering regression for every sprite expression."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/hisui-alignment')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 results=[]
 for w,h in [(1366,768),(1920,911),(2560,1080),(3440,1440),(390,844),(844,390),(360,640),(320,568),(768,1024)]:
  page=b.new_page(viewport={'width':w,'height':h},reduced_motion='reduce');page.goto('http://127.0.0.1:4175');page.locator('[data-action="new"]').click();page.wait_for_timeout(300)
  cases=page.evaluate('''()=>{let results=[];for(const p of HisuiStory.people){for(let face=0;face<(p.row===null?6:3);face++){document.querySelector('.cast-stage').innerHTML=portrait(p.id,face);fitCast();const e=document.querySelector('.cast-stage .portrait'),r=e.getBoundingClientRect(),d=document.querySelector('.dialogue').getBoundingClientRect(),t=document.querySelector('.theater').getBoundingClientRect(),f=HisuiSpriteDisplay[e.dataset.sprite],clip=e.parentElement.getBoundingClientRect(),bottom=Math.min(r.top+f.bounds[3]*r.height,clip.bottom);results.push({name:p.name,face,gap:d.top-bottom,top:r.top+f.bounds[1]*r.height,stageTop:t.top,filter:getComputedStyle(e).filter,ratio:r.width/r.height});}}return results;}''')
  assert len(cases)==120
  for c in cases:
   assert -16<=c['gap']<=0,(w,h,c)
   assert c['top']>=c['stageTop']+20,(w,h,c)
   assert 'sprite-clean' in c['filter'],c
   assert abs(c['ratio']-1)<.001,(w,h,c)
  # Short and long dialogue pages must both keep the shared anchor.
  for text in ['はい。','表示の折り返しと人物の位置を確認します。'*5]:
   page.locator('#speech').evaluate('(e,text)=>e.textContent=text',text);page.evaluate('fitCast()')
   assert page.evaluate('document.documentElement.scrollHeight<=innerHeight && document.documentElement.scrollWidth<=innerWidth'), (w,h,page.evaluate('({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight})'))
   delta=page.evaluate('''()=>{const p=document.querySelector('.cast-stage .portrait'),r=p.getBoundingClientRect(),f=HisuiSpriteDisplay[p.dataset.sprite];return document.querySelector('.dialogue').getBoundingClientRect().top-Math.min(r.top+f.bounds[3]*r.height,p.parentElement.getBoundingClientRect().bottom)}''')
   assert -16<=delta<=0,delta
  page.evaluate('render()');page.wait_for_timeout(300);page.screenshot(path=str(OUT/f'{w}x{h}-dialogue.png'))
  # Orientation change while still in conversation must re-anchor without advancing text.
  page.set_viewport_size({'width':h,'height':w});page.wait_for_timeout(250)
  assert page.evaluate('document.documentElement.scrollHeight<=innerHeight && document.documentElement.scrollWidth<=innerWidth'), (w,h,page.evaluate('({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight})'))
  results.append({'viewport':[w,h],'expressions':len(cases),'noGaps':True,'matteFilter':True})
  page.close()
 # Verify actual pixel alpha output, not just the CSS declaration.
 page=b.new_page();page.goto('http://127.0.0.1:4175')
 alpha=page.evaluate('''async()=>{let out=[];for(const src of Object.keys(HisuiSpriteBounds)){const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0);const raw=x.getImageData(0,0,c.width,c.height).data;x.clearRect(0,0,c.width,c.height);x.filter='url(#sprite-clean)';x.drawImage(img,0,0);const clean=x.getImageData(0,0,c.width,c.height).data;let low=0,remaining=0,body=0,opaque=0;for(let i=3;i<raw.length;i+=4){if(raw[i]>0&&raw[i]<=50){low++;if(clean[i]>0)remaining++;}if(raw[i]>=245){body++;if(clean[i]>=254)opaque++;}}out.push({src,low,remaining,body,opaque});}return out;}''')
 for a in alpha:
  assert a['remaining']==0,a
  assert a['opaque']==a['body'],a
 b.close();report={'geometry':results,'alpha':alpha};(OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({'viewports':len(results),'expressionChecks':sum(c['expressions'] for c in results),'atlasesAlphaChecked':len(alpha),'allPassed':True}))
