"""Build the cleaned geography diagram and clickable region index.

Run with: python build-geographic-assets.py path/to/2545.jpg
Pillow is required. Polygons and region IDs are stored in geographic-regions.json.
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


SIZE = (1011, 1082)
ASSET_DIR = Path(__file__).resolve().parent
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("2545.jpg")

photo = Image.open(SOURCE).crop((0, 0, 1750, 1800)).convert("L")
photo = ImageOps.autocontrast(photo, cutoff=1)
photo = photo.filter(ImageFilter.MedianFilter(3))
photo = photo.point(lambda value: 0 if value < 165 else 255)

width = SIZE[0]
height = round(photo.height * width / photo.width)
photo = photo.resize((width, height), Image.Resampling.LANCZOS)
base = Image.new("L", SIZE, 255)
base.paste(photo, (0, (SIZE[1] - height) // 2))

# This thin mark is a scan artifact above the map outline.
ImageDraw.Draw(base).rectangle((0, 0, 290, 32), fill=255)
base.convert("RGB").save(ASSET_DIR / "africa-geographic-map.png")

definitions = json.loads((ASSET_DIR / "geographic-regions.json").read_text(encoding="utf-8"))
index = Image.new("L", SIZE, 1)
draw = ImageDraw.Draw(index)
for name, points in definitions["polygons"].items():
    draw.polygon([tuple(point) for point in points], fill=definitions["regionIds"][name])

# Preserve dark outline and dashed separator pixels as non-clickable borders.
base_pixels = base.load()
index_pixels = index.load()
for y in range(SIZE[1]):
    for x in range(SIZE[0]):
        if base_pixels[x, y] < 128:
            index_pixels[x, y] = 0

index.save(ASSET_DIR / "geographic-region-index.png")
print(f"Wrote geography assets at {SIZE[0]}×{SIZE[1]}.")
