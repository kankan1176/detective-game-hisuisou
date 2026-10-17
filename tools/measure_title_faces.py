"""Frame neutral headshots from calibrated display metrics; never rewrite source art."""
import json, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
frames=json.loads(subprocess.check_output(['node','-p','global.window={};require("./dist/sprite-display.js");JSON.stringify(window.HisuiSpriteDisplay)'],cwd=ROOT,text=True))
crops={}
for person_id in range(23):
 f=frames[f'{person_id}:0'];span=.58/f['scale']
 # Negative origins intentionally add clear space above an otherwise high face.
 crops[person_id]={'x':round(f['cx']-span/2,6),'y':round(f['eye']-span/2,6),'span':round(span,6)}
(ROOT/'dist/title-face-layout.js').write_text('/* Calibrated neutral headshots: centered faces and uniform, undistorted scale. */\nwindow.HisuiTitleFaces='+json.dumps(crops,separators=(',',':'))+';\n')
print(f'Framed {len(crops)} neutral head crops')
