"""Check actual rendered masks and replacement loading; anatomy is reviewed visually."""
from io import BytesIO
from pathlib import Path
import json
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path('/tmp/hisui-sprite-art')
OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':600,'height':600}, reduced_motion='reduce')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:4175', wait_until='networkidle')
    art = page.evaluate('HisuiSpriteArt')
    people = page.evaluate('D.people')
    assert set(art['replacements']) == {'2:2','7:3','16:2','17:0','19:1','21:1'}
    page.evaluate('stopTitleCycle()')
    page.add_style_tag(content='''
      html,body,#app{height:600px!important;background:transparent!important}
      .topbar{display:none}
      #app>.portrait{width:512px!important;height:512px!important;max-width:none!important;
        margin:0!important;transform:none!important;animation:none!important}
    ''')
    page.evaluate('''async()=>{await Promise.all([
      ...D.people.map(p=>p.art), ...Object.values(HisuiSpriteArt.replacements).map(r=>r.src)
    ].map(async src=>{const i=new Image();i.src=src;await i.decode()}))}''')
    removed = preserved = 0
    for key, rectangles in art['masks'].items():
        person_id, face = map(int, key.split(':'))
        person = people[person_id]
        page.evaluate('([id,face])=>app.innerHTML=portrait(id,face)', [person_id,face])
        element = page.locator('#app>.portrait')
        assert element.evaluate('e=>getComputedStyle(e).maskImage') != 'none', key
        data = element.screenshot(omit_background=True, animations='disabled')
        (OUT/f'{person_id:02d}-{face}.png').write_bytes(data)
        actual = np.array(Image.open(BytesIO(data)).getchannel('A'))
        source = Image.open(ROOT/'dist'/person['art']).getchannel('A')
        row = face//3 if person['row'] is None else person['row']
        col = face%3
        raw = np.array(source.crop((col*512,row*512,(col+1)*512,(row+1)*512)))
        masked = np.zeros((512,512), dtype=bool)
        for x,y,right,bottom in rectangles:
            masked[y:bottom,x:right] = True
        foreign = masked & (raw >= 245)
        body = ~masked & (raw >= 245)
        assert foreign.any(), key
        assert (actual[foreign] == 0).all(), (key,'neighbor fragment remains')
        assert (actual[body] == 255).all(), (key,'body outside mask changed')
        removed += int(foreign.sum())
        preserved += int(body.sum())
    for key, repair in art['replacements'].items():
        person_id, face = map(int, key.split(':'))
        page.evaluate('([id,face])=>app.innerHTML=portrait(id,face)', [person_id,face])
        element = page.locator('#app>.portrait')
        assert repair['src'] in element.evaluate('e=>getComputedStyle(e).backgroundImage'), key
        assert element.evaluate('e=>getComputedStyle(e).backgroundSize') == '100% 100%', key
        image = Image.open(ROOT/'dist'/repair['src'])
        assert image.mode == 'RGBA' and image.width == image.height, key
        assert image.getchannel('A').crop((0,0,20,20)).getextrema() == (0,0), key
        element.screenshot(path=str(OUT/f'{person_id:02d}-{face}.png'), omit_background=True)
    assert not errors, errors
    browser.close()
print(json.dumps({'replacementSprites':len(art['replacements']),
                  'maskedVariants':len(art['masks']),
                  'foreignOpaquePixelsRemoved':removed,
                  'bodyOpaquePixelsPreserved':preserved,'allPassed':True}))
