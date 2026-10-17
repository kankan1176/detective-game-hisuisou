"""Measure neutral head crops for the title UI. Source images are never rewritten."""
import json
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
people = json.loads(subprocess.check_output(
    ['node', '-p', 'JSON.stringify(require("./dist/story-data.js").people)'],
    cwd=ROOT, text=True))
repairs = json.loads(subprocess.check_output(
    ['node', '-p', 'global.window={};require("./dist/sprite-art.js");JSON.stringify(window.HisuiSpriteArt.replacements)'],
    cwd=ROOT, text=True))
crops = {}
for person in people:
    replacement = repairs.get(f'{person["id"]}:0')
    image = Image.open(ROOT / 'dist' / (replacement['src'] if replacement else person['art'])).convert('RGBA')
    width, height = image.size if replacement else (image.width // 3, image.height // 2)
    row = 0 if replacement else (person['row'] or 0)
    alpha = image.getchannel('A').crop((0, row * height, width, (row + 1) * height))
    box = alpha.point(lambda a: 255 if a >= 200 else 0).getbbox()
    top = box[1]
    # The upper silhouette locates the head without allowing hands/props to shift it.
    band = alpha.crop((0, top + int(height * .07), width, top + int(height * .23)))
    pixels = band.load()
    columns = [sum(pixels[x, y] for y in range(band.height)) for x in range(width)]
    center = sum(x * weight for x, weight in enumerate(columns)) / sum(columns) / width
    span = .58 if person['id'] >= 17 else .53
    crops[person['id']] = {
        'x': round(max(0, min(1 - span, center - span / 2)), 6),
        # Keep the chef's face the same scale; the upper toque can leave the frame.
        'y': .13 if person['id'] == 16 else round(max(0, top / height - .012), 6),
        'span': span,
    }
(ROOT / 'dist' / 'title-face-layout.js').write_text(
    '/* Neutral head crop coordinates; original PNGs are unchanged. */\n'
    'window.HisuiTitleFaces=' + json.dumps(crops, separators=(',', ':')) + ';\n')
print(f'Measured {len(crops)} neutral head crops')
