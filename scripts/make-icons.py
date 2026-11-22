"""生成 CyberTrack 的 PWA 图标：黑底 + 白色命令行提示符（>_）。

用法：python scripts/make-icons.py
需要 Pillow：pip install pillow
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
CANVAS = 1024


def draw_icon(size: int, padding: float) -> Image.Image:
    img = Image.new("RGB", (CANVAS, CANVAS), "#000000")
    draw = ImageDraw.Draw(img)
    s = CANVAS
    width = int(s * 0.075)
    left = s * (0.5 - padding)
    right = s * (0.5 + padding)
    top = s * (0.5 - padding * 0.72)
    bottom = s * (0.5 + padding * 0.72)

    # “>” 折线
    mid = s * 0.5
    draw.line(
        [(left, top + (bottom - top) * 0.12), (mid - s * 0.01, mid), (left, bottom - (bottom - top) * 0.12)],
        fill="#ffffff",
        width=width,
        joint="curve",
    )
    # 下划线
    draw.line(
        [(mid + s * 0.02, bottom - (bottom - top) * 0.12), (right, bottom - (bottom - top) * 0.12)],
        fill="#ffffff",
        width=width,
    )
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    outputs = [
        ("icon-180.png", 180, 0.20),
        ("icon-192.png", 192, 0.20),
        ("pwa-192x192.png", 192, 0.20),
        ("icon-512.png", 512, 0.20),
        ("maskable-512.png", 512, 0.16),
    ]
    for name, size, padding in outputs:
        draw_icon(size, padding).save(PUBLIC / name, optimize=True)
        print(f"wrote public/{name}")
    print("done")


if __name__ == "__main__":
    main()
