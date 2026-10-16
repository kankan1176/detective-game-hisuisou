"""Capture small portrait UI elements; source illustration PNGs are never rewritten.

Requires the local preview server, Playwright and Chromium. Run measure_title_faces.py
first. Each output is a transparent browser screenshot of the measured head crop.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/assets/story/ui/faces'
OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1100, 'height': 1100}, reduced_motion='reduce')
    page.goto('http://127.0.0.1:4175', wait_until='networkidle')
    page.add_script_tag(content=(ROOT / 'dist/title-face-layout.js').read_text())
    page.evaluate('''()=>{
      stopTitleCycle();
      app.innerHTML='<div class="portrait-captures">'+D.people.map(p=>{
        const c=HisuiTitleFaces[p.id];
        return `<div class="head-capture" data-id="${p.id}" style="--span:${c.span};--x:${c.x/c.span};--y:${c.y/c.span}">${portrait(p.id)}</div>`;
      }).join('')+'</div>';
    }''')
    page.add_style_tag(content='''
      html,body,#app{height:1100px!important;background:transparent!important}
      .topbar{display:none}
      .portrait-captures{display:grid;grid-template-columns:repeat(5,192px);gap:10px;padding:10px}
      .head-capture{position:relative;width:192px;height:192px;overflow:hidden;background:transparent}
      .head-capture .portrait{position:absolute;width:calc(100% / var(--span));max-width:none;
        left:calc(-100% * var(--x));top:calc(-100% * var(--y));transform:none;filter:url(#sprite-clean)}
    ''')
    page.evaluate('''async()=>{await Promise.all([...new Set(D.people.map(p=>p.art))].map(async src=>{
      const image=new Image();image.src=src;await image.decode();
    }));}''')
    for person_id in range(23):
        page.locator(f'.head-capture[data-id="{person_id}"]').screenshot(
            path=str(OUT / f'{person_id}.png'), omit_background=True, animations='disabled')
    browser.close()
print(f'Captured 23 neutral portrait elements: {sum(p.stat().st_size for p in OUT.glob("*.png")):,} bytes')
