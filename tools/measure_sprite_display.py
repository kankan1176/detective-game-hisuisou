"""Measure visible bounds and record visual focal points; never edit image pixels.

Focal points are calibrated in a 512px source cell. Expression movement is derived
from the upper silhouette. Regenerated poses have their own explicit focal point.
"""
import json, subprocess
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
people=json.loads(subprocess.check_output(['node','-p','JSON.stringify(require("./dist/story-data.js").people)'],cwd=ROOT,text=True))
art=json.loads(subprocess.check_output(['node','-p','global.window={};require("./dist/sprite-art.js");JSON.stringify(window.HisuiSpriteArt)'],cwd=ROOT,text=True))
# Face center, eye line, optical scale. Hair, hats and props do not set the center.
focal=[(270,164,1),(286,164,1),(264,175,1),(275,148,1),(275,146,1),(297,169,.98),(273,149,1),(280,156,1),(286,164,1),(255,164,1),(277,158,1),(275,158,1),(274,163,1),(280,168,1),(267,169,1),(237,194,1),(267,201,1.10),(259,94,1.30),(270,117,1.12),(293,133,1.10),(265,110,1.15),(282,140,1.10),(257,112,1.12)]
explicit={'2:2':(228,173,1),'7:3':(257,145,1.08),'16:2':(245,184,1.18),'17:0':(259,94,1.30),'19:1':(258,135,1.10),'21:1':(247,140,1.10)}
def measure(p,face):
 key=f'{p["id"]}:{face}';r=art['replacements'].get(key);im=Image.open(ROOT/'dist'/(r['src'] if r else p['art'])).convert('RGBA')
 if not r:
  w,h=im.width//3,im.height//2;row=face//3 if p['row'] is None else p['row'];col=face%3
  im=im.crop((col*w,row*h,(col+1)*w,(row+1)*h))
 a=im.getchannel('A').point(lambda v:255 if v>=200 else 0)
 for l,t,r,b in art['masks'].get(key,[]):
  # Alter analysis data only, not the source PNG.
  a.paste(0,(l,t,r,b))
 box=a.getbbox();top=box[1]/im.height
 band=a.crop((0,box[1]+int(im.height*.07),im.width,box[1]+int(im.height*.23)))
 columns=[sum(band.getpixel((x,y)) for y in range(band.height)) for x in range(band.width)]
 center=sum(x*v for x,v in enumerate(columns))/sum(columns)/im.width
 return [round(v/(im.width if i%2==0 else im.height),6) for i,v in enumerate(box)],top,center
frames={}
for p in people:
 neutral=measure(p,0);cx,eye,scale=focal[p['id']]
 for face in range(6 if p['row'] is None else 3):
  key=f'{p["id"]}:{face}';bounds,top,center=measure(p,face)
  if key in explicit:x,y,s=explicit[key];x/=512;y/=512
  else:
   x=cx/512+max(-.10,min(.10,center-neutral[2]));y=eye/512+(top-neutral[1]);s=scale
   if p['id']==17:s=1.15;y=135/512+(top-neutral[1])
  frames[key]={'bounds':bounds,'cx':round(x,6),'eye':round(y,6),'scale':s}
(ROOT/'dist/sprite-display.js').write_text('/* Visible bounds and calibrated face framing, with uniform scaling only. */\nwindow.HisuiSpriteDisplay='+json.dumps(frames,separators=(',',':'))+';\n')
print(f'Measured {len(frames)} display frames')
