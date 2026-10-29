"""Build the cleaned third diagram and its clickable river/landmark regions.

Run with: python build-water-assets.py path/to/odod.png
Pillow is required. The editable target geometry is in water-regions.json.
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


SIZE = (1011, 1082)
ASSET_DIR = Path(__file__).resolve().parent
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("odod.png")

# Keep the full sheet and fit it to the same canvas as the other maps. The
# white page border makes this robust to slightly different photo dimensions.
photo = Image.open(SOURCE).convert("L")
photo = ImageOps.autocontrast(photo, cutoff=1)
photo = photo.filter(ImageFilter.MedianFilter(3))
photo = photo.point(lambda value: 0 if value < 172 else 255)
scale = min(SIZE[0] / photo.width, SIZE[1] / photo.height)
resized = photo.resize((round(photo.width * scale), round(photo.height * scale)), Image.Resampling.LANCZOS)
base = Image.new("L", SIZE, 255)
base.paste(resized, ((SIZE[0] - resized.width) // 2, (SIZE[1] - resized.height) // 2))
base.convert("RGB").save(ASSET_DIR / "africa-water-map.png")

definitions = json.loads((ASSET_DIR / "water-regions.json").read_text(encoding="utf-8"))
index = Image.new("L", SIZE, 1)
draw = ImageDraw.Draw(index)
for path in definitions["paths"]:
    points = [tuple(point) for point in path["points"]]
    draw.line(points, fill=definitions["regionIds"][path["name"]], width=path["width"], joint="curve")
    radius = path["width"] // 2
    for x, y in points:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=definitions["regionIds"][path["name"]])
    # Large, overlapping click zones make narrow rivers easier to select.
    circle_radius = path.get("circleRadius")
    if circle_radius:
        region_id = definitions["regionIds"][path["name"]]
        spacing = circle_radius * 1.35
        distance_to_next = 0
        for start, end in zip(points, points[1:]):
            dx, dy = end[0] - start[0], end[1] - start[1]
            segment_length = (dx * dx + dy * dy) ** 0.5
            if not segment_length:
                continue
            while distance_to_next <= segment_length:
                fraction = distance_to_next / segment_length
                x = round(start[0] + dx * fraction)
                y = round(start[1] + dy * fraction)
                draw.ellipse((x - circle_radius, y - circle_radius, x + circle_radius, y + circle_radius), fill=region_id)
                distance_to_next += spacing
            distance_to_next -= segment_length
        x, y = points[-1]
        draw.ellipse((x - circle_radius, y - circle_radius, x + circle_radius, y + circle_radius), fill=region_id)
for name, points in definitions["polygons"].items():
    draw.polygon([tuple(point) for point in points], fill=definitions["regionIds"][name])

# Keep the source diagram's outlines and lake edges non-clickable.
base_pixels = base.load()
index_pixels = index.load()
for y in range(SIZE[1]):
    for x in range(SIZE[0]):
        if base_pixels[x, y] < 128:
            index_pixels[x, y] = 0

index.save(ASSET_DIR / "water-region-index.png")
print(f"Wrote water/landmark assets at {SIZE[0]}×{SIZE[1]}.")
