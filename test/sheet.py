# Unisce gli screenshot di un'inquadratura in un unico foglio: python3 test/sheet.py bust
import sys
from PIL import Image, ImageDraw
f = sys.argv[1] if len(sys.argv) > 1 else "bust"  # es. "bust" oppure "serio-bust"
states = ["idle", "listening", "processing", "responding"]
for view in ["verticale", "orizzontale"]:
    ims = [Image.open(f"test/shots/{f}-{view}-{s}.png").convert("RGB") for s in states]
    w, h = ims[0].size
    cols = 4 if view == "verticale" else 2
    rows = len(ims) // cols
    sheet = Image.new("RGB", (w * cols, (h + 24) * rows), "#000")
    d = ImageDraw.Draw(sheet)
    for i, (im, s) in enumerate(zip(ims, states)):
        x, y = (i % cols) * w, (i // cols) * (h + 24)
        sheet.paste(im, (x, y + 24)); d.text((x + 6, y + 6), s, fill="#fff")
    sheet.save(f"test/shots/{f}-{view}-foglio.png")
    print(f"test/shots/{f}-{view}-foglio.png")
