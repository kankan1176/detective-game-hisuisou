"""Browser regression: run the game with npm start, then python tests/ui_smoke.py.
Requires Python playwright and Chromium; no runtime dependencies are added to the game.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('HISUI_TEST_URL', 'http://127.0.0.1:4175')
SHOTS = Path(os.environ.get('HISUI_SCREENSHOTS', '/tmp/hisui-ui'))
SHOTS.mkdir(parents=True, exist_ok=True)
ROUTE = [[12,'case'],[2,'case'],[9,'alibi'],[13,'note'],[2,'kitchen'],[1,'case'],[8,'alibi'],[15,'alibi'],[11,'kitchen'],[9,'note'],[13,'kitchen'],[6,'alibi'],[8,'case'],[14,'kitchen'],[5,'note'],[1,'kitchen'],[11,'alibi'],[4,'kitchen'],[10,'kitchen'],[15,'kitchen'],[0,'alibi'],[2,'note'],[12,'kitchen'],[11,'note'],[7,'note']]

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    for width,height in [(1366,768),(390,844),(844,390),(360,640),(320,568)]:
        page = browser.new_page(viewport={'width':width,'height':height})
        errors=[]; failed=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('response',lambda r:failed.append((r.status,r.url)) if r.status>=400 else None)
        page.goto(BASE);page.wait_for_timeout(150)
        def check():
            page.wait_for_timeout(70)
            assert page.evaluate('document.documentElement.scrollHeight<=innerHeight && document.documentElement.scrollWidth<=innerWidth'), 'Whole-page overflow'
            assert not errors,errors
            if page.locator('.dialogue-box>p .folio-viewport').count():
                assert page.locator('.dialogue-box>p .folio-viewport').evaluate('e=>e.clientHeight>=28'), 'Dialogue text area collapsed'
        def click(selector):
            page.evaluate('(selector)=>document.dispatchEvent(new CustomEvent("folio:reveal",{detail:{selector}}))',selector)
            page.wait_for_timeout(70)
            loc=page.locator(selector).first
            # A hit target must be fully on its current page; a hidden scroll area cannot make it pass.
            assert loc.evaluate('''el=>{const r=el.getBoundingClientRect(), v=el.closest('.folio-content')?.parentElement.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1&&(!v||(r.top>=v.top-1&&r.bottom<=v.bottom+1&&r.left>=v.left-1&&r.right<=v.right+1));}'''), f'Clipped control: {selector} at {width}x{height}'
            loc.click(timeout=5000);check()
        def read_pages(root):
            for _ in range(50):
                next_page=page.locator(root+' > .folio-controls button').last
                if not next_page.count() or next_page.is_disabled():return
                next_page.click();check()
            raise AssertionError('Unbounded pagination')
        def shot(name):page.screenshot(path=str(SHOTS/f'{width}x{height}-{name}.png'))
        check();shot('cover')
        assert '16人の個性と、すれ違う真実' in page.locator('body').inner_text()
        click('#new-game');shot('prologue')
        scenes=set();speakers=set();beats=0
        while page.evaluate('view')=='opening':
            scenes.add(page.evaluate('openingPage'));speakers.add(page.locator('.cinema-name').inner_text())
            assert page.locator('.cinema-portrait').count()==2
            for portrait in page.locator('.cinema-portrait').all():
                assert portrait.evaluate('el=>el.getBoundingClientRect().width>80 && getComputedStyle(el).backgroundImage.includes("atlas.png")')
            read_pages('#opening-text');click('#intro-next');beats+=1
            assert beats<80
        assert scenes==set(range(5)) and {'レイカ','カレン','タクミ','ナナミ'}.issubset(speakers)
        before=page.evaluate('JSON.stringify({turn:state.turn,evidence:state.evidence,trust:state.trust})')
        for stage in range(15):
            assert page.evaluate('practice.stage')==stage
            if stage==0:shot('tutorial')
            click('#tutorial-explain');read_pages('#modal-body');click('#lesson-close')
            if stage in [0,1,10,14]:click('#tutorial-next')
            elif stage in [2,3]:
                key='a' if stage==2 else 'b';click('[data-picker="'+key+'"]')
                assert page.locator('[data-'+key+'] strong').all_text_contents()==page.evaluate('HISUI.people.map(p=>p.name)')
                click('[data-'+key+']:not([disabled])')
            elif stage==4:click('[data-topic]')
            elif stage==5:click('[data-approach]')
            elif stage==6:
                page.locator('#practice-proof-select').select_option('cup');click('#practice-proof-confirm')
            elif stage==7:click('#talk')
            elif stage==8:
                while page.locator('#line-next').count():read_pages('.dialogue-box>p');click('#line-next')
                read_pages('.dialogue-box>p');click('#dialogue-done')
            elif stage==9:
                page.locator('#practice-proof-0').select_option('cup');page.locator('#practice-proof-1').select_option('inventory');click('#practice-compare')
            elif stage==11:click('[data-profile]');click('#practice-profile-done')
            elif stage==12:click('#practice-history');click('#practice-history-done')
            elif stage==13:
                page.locator('#practice-answer-0').select_option('cup');page.locator('#practice-answer-1').select_option('manor');click('#practice-submit')
        assert before==page.evaluate('JSON.stringify({turn:state.turn,evidence:state.evidence,trust:state.trust})')
        assert page.evaluate('practice===null && state.tutorialDone')
        shot('investigation');click('#mission-help');click('#chapter-story');read_pages('#modal-body');click('#back-to-action');click('#follow-action')
        assert page.evaluate('selection.b===2 && selection.topic==="case" && state.turn===0')
        click('#talk');shot('dialogue')
        longest=0
        while True:
            longest=max(longest,len(page.locator('.dialogue-box>p .folio-content').inner_text()))
            read_pages('.dialogue-box>p')
            if page.locator('#line-next').count():click('#line-next')
            else:break
        assert longest>100, 'Amended long testimony did not execute'
        click('#dialogue-done');read_pages('#modal-body');click('#finish-dialogue')
        assert page.evaluate('state.turn===1 && state.evidence.includes("key")')
        page.reload();page.wait_for_timeout(150);click('#resume');assert page.evaluate('state.turn')==1
        for tab in ['people','history','notebook','final']:click('[data-reference="'+tab+'"]')
        click('[data-reference="people"]');click('[data-profile="0"]');shot('profile');read_pages('#reference-panel');click('#profile-list')
        # Every amended testimony must be displayable in full, including its authored line breaks.
        for lead_index in range(6):
            page.evaluate("""i=>{
              const l=HISUI.leads[i];state=Game.initial();state.started=true;state.tutorialDone=true;
              state.turn=l.min;state.evidence=[...l.req];
              const a=HISUI.people.find(p=>p.name===HISUI.people[l.target].good).id;
              shown=Game.talk(state,{a,b:l.target,topic:l.topic,approach:HISUI.people[l.target].type[2]==='T'?'logic':'empathy'});
              dialogueIndex=shown.lines.findIndex(line=>line.text===l.text);view='reading';sideTab='notebook';renderDialogue();
            }""",lead_index)
            check()
            assert page.locator('.dialogue-box>p .folio-content').inner_text()==page.evaluate(f'HISUI.leads[{lead_index}].text')
            root=page.locator('.dialogue-box>p')
            next_page=root.locator(':scope>.folio-controls button').last
            if next_page.is_enabled():
                advance=page.locator('#line-next, #dialogue-done').first
                assert advance.is_disabled(), 'Long text could be skipped before its last page'
            read_pages('.dialogue-box>p')
            assert page.locator('#line-next, #dialogue-done').first.is_enabled()
            if lead_index==2:shot('long-testimony')
        # A guide must open and populate the real comparison controls without consuming a turn.
        page.evaluate("""route=>{
          state=Game.initial();state.started=true;state.tutorialDone=true;
          for(const [b,topic]of route.slice(0,6)){const a=HISUI.people.find(p=>p.name===HISUI.people[b].good).id;Game.talk(state,{a,b,topic,approach:HISUI.people[b].type[2]==='T'?'logic':'empathy'});}
          sideTab='notebook';view='board';render();
        }""",ROUTE)
        click('#mission-help');click('#follow-action')
        assert page.locator('#compare-0').input_value()=='metal' and page.locator('#compare-1').input_value()=='structure'
        click('#compare-evidence');assert page.evaluate('state.turn===6 && state.comparisons.includes("tool")')
        assert '工具傷と構造図が一致' in page.locator('#compare-feedback').inner_text()
        shot('comparison')
        click('.motion-toggle');assert page.evaluate('document.body.classList.contains("still")')
        click('.motion-toggle');assert page.evaluate('!document.body.classList.contains("still")')
        # Reproduce a complete existing route to exercise late chapters and final UI.
        page.evaluate('''route=>{
          state=Game.initial();state.started=true;state.tutorialDone=true;
          for(const [b,topic]of route){const a=HISUI.people.find(p=>p.name===HISUI.people[b].good).id;Game.talk(state,{a,b,topic,approach:HISUI.people[b].type[2]==='T'?'logic':'empathy'});}
          for(const r of Game.comparisons)Game.compare(state,r.pair);
          while(state.turn<30)Game.talk(state,{a:0,b:3,topic:'case',approach:'logic'});
          sideTab='notebook';view='board';render();
        }''',ROUTE)
        check();click('#to-final');shot('final')
        assert page.locator('#answer-0').count()==1
        for i,value in enumerate(['chef','driver','lid','mix','hide','shaft']):
            page.evaluate('(s)=>document.dispatchEvent(new CustomEvent("folio:reveal",{detail:{selector:s}}))',f'#answer-{i}')
            page.locator(f'#answer-{i}').select_option(value)
        for i,value in enumerate(['staff','structure','conceal']):
            page.evaluate('(s)=>document.dispatchEvent(new CustomEvent("folio:reveal",{detail:{selector:s}}))',f'#final-proof-{i}')
            page.locator(f'#final-proof-{i}').select_option(value)
        click('#submit');read_pages('#modal-body');click('#confirm-submit');shot('ending')
        assert page.evaluate('state.result.rank')=='完全解決'
        read_pages('#app>.reading');click('#result-notes');assert page.locator('#notes').count()==1
        check();assert not failed,failed
        print(f'PASS {width}x{height}: all prologue scenes/speakers, 15 tutorial stages, names, full hit targets, long dialogue pages, guidance, save/reload, profiles, final submission and ending; no scroll/errors/missing assets',flush=True)
        page.close()
    browser.close()
