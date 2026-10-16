"""Measure sprite alpha bounds only. This never edits or resaves source images."""
from pathlib import Path
from PIL import Image
import json
ROOT=Path(__file__).resolve().parents[1]/'dist'
paths=sorted((ROOT/'assets/characters').glob('*-atlas.png'))+sorted((ROOT/'assets/story/characters').glob('*.png'))
bounds={}
for p in paths:
 im=Image.open(p).convert('RGBA');w,h=im.width//3,im.height//2
 cells=[]
 for row in range(2):
  for col in range(3):
   alpha=im.getchannel('A').crop((col*w,row*h,(col+1)*w,(row+1)*h))
   box=alpha.point(lambda a:255 if a>=200 else 0).getbbox()
   if not box:raise ValueError(f'Empty sprite cell: {p} {col},{row}')
   cells.append({'tail':round((h-box[3])/h,6),'top':round(box[1]/h,6),'bbox':list(box)})
 bounds[str(p.relative_to(ROOT))]=cells
(ROOT/'sprite-layout.js').write_text('/* Measured opaque bounds; original PNGs are unchanged. */\nwindow.HisuiSpriteBounds='+json.dumps(bounds,separators=(',',':'))+';\n')
print(f'Measured {len(paths)} atlases / {sum(map(len,bounds.values()))} cells')
