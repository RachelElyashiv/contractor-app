"""Generates the app icon set.

The mark is a building under construction: three solid floors with a window
grid, and a crane arm reaching over it. It is drawn with flat shapes and
heavy strokes so it still reads at 48px in a launcher.

Run: python3 scripts/make-icons.py
"""
from PIL import Image, ImageDraw

GREEN = (26, 107, 74)       # the app's brand green, #1a6b4a
GREEN_DEEP = (18, 82, 56)
WHITE = (255, 255, 255)
AMBER = (242, 180, 60)      # the crane, for a spot of warmth

OUT = 'assets/images'


def draw_mark(d, cx, cy, unit, crane=True):
    """Draws the mark centred on cx, cy. `unit` scales it.

    A tower with lit windows standing on a ground line, and a tower crane
    beside it whose jib reaches across the top.
    """
    u = unit
    ground = cy + 2.05 * u

    if crane:
        # --- crane, drawn first so the tower overlaps the mast foot ---
        mast_w = 0.20 * u
        mast_x = cx + 1.50 * u
        d.rounded_rectangle([mast_x - mast_w / 2, cy - 2.30 * u,
                             mast_x + mast_w / 2, ground],
                            radius=0.06 * u, fill=AMBER)

        jib_h = 0.20 * u
        jib_y = cy - 2.30 * u
        d.rounded_rectangle([cx - 1.95 * u, jib_y,
                             mast_x + 0.40 * u, jib_y + jib_h],
                            radius=0.06 * u, fill=AMBER)

        # cable and the block it carries
        hook_x = cx - 1.55 * u
        d.rectangle([hook_x - 0.045 * u, jib_y + jib_h,
                     hook_x + 0.045 * u, cy - 1.30 * u], fill=AMBER)
        d.rounded_rectangle([hook_x - 0.30 * u, cy - 1.30 * u,
                             hook_x + 0.30 * u, cy - 0.78 * u],
                            radius=0.08 * u, fill=AMBER)

    # --- tower ---
    left, right = cx - 1.05 * u, cx + 0.95 * u
    top = cy - 1.55 * u
    d.rounded_rectangle([left, top, right, ground],
                        radius=0.12 * u, fill=WHITE)

    # --- windows: four rows of three, punched in the brand colour ---
    cols, rows = 3, 4
    win = 0.30 * u
    span_x = right - left
    gap_x = (span_x - cols * win) / (cols + 1)
    first_row = top + 0.34 * u
    gap_y = 0.30 * u
    for r in range(rows):
        wy = first_row + r * (win + gap_y)
        for c in range(cols):
            wx = left + gap_x + c * (win + gap_x)
            d.rounded_rectangle([wx, wy, wx + win, wy + win],
                                radius=0.06 * u, fill=GREEN)

    # --- ground line, wider than the tower, anchoring both ---
    d.rounded_rectangle([cx - 2.00 * u, ground,
                         cx + 2.00 * u, ground + 0.26 * u],
                        radius=0.13 * u, fill=WHITE)


def rounded_bg(size, radius_ratio, colour):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * radius_ratio)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=colour)
    return img


def supersample(size, paint):
    """Draws at 4x and scales down, so every edge is clean."""
    scale = 4
    img = Image.new('RGBA', (size * scale, size * scale), (0, 0, 0, 0))
    paint(ImageDraw.Draw(img), size * scale)
    return img.resize((size, size), Image.LANCZOS)


def main():
    # 1. The store / iOS icon: the mark on a solid green tile, filling the square.
    size = 1024
    base = Image.new('RGBA', (size, size), GREEN)
    mark = supersample(size, lambda d, s: draw_mark(d, s / 2, s * 0.50, s * 0.150))
    base.alpha_composite(mark)
    base.convert('RGB').save(f'{OUT}/icon.png')

    # 2. Android adaptive foreground. The launcher masks this to a circle and
    #    crops hard, so the mark sits inside the middle two thirds.
    size = 512
    fg = supersample(size, lambda d, s: draw_mark(d, s / 2, s * 0.50, s * 0.118))
    fg.save(f'{OUT}/android-icon-foreground.png')

    # 3. Adaptive background: a flat brand tile.
    bg = Image.new('RGBA', (size, size), GREEN)
    bg.save(f'{OUT}/android-icon-background.png')

    # 4. Monochrome (themed icons on Android 13+): the silhouette only.
    mono = supersample(size, lambda d, s: draw_mark(d, s / 2, s * 0.50, s * 0.118, crane=False))
    white = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    white.paste((255, 255, 255, 255), (0, 0), mono.split()[3])
    white.save(f'{OUT}/android-icon-monochrome.png')

    # 5. Splash mark: the building on transparent, for the launch screen.
    size = 512
    splash = supersample(size, lambda d, s: draw_mark(d, s / 2, s * 0.50, s * 0.110))
    splash.save(f'{OUT}/splash-icon.png')

    # 6. Favicon for the web build.
    fav = rounded_bg(96, 0.22, GREEN)
    fav.alpha_composite(supersample(96, lambda d, s: draw_mark(d, s / 2, s * 0.50, s * 0.130)))
    fav.save(f'{OUT}/favicon.png')

    print('wrote icon.png, android-icon-{foreground,background,monochrome}.png, '
          'splash-icon.png, favicon.png')


if __name__ == '__main__':
    main()
