"""Export the two lecture decks and their assets into public/ for static hosting."""

import re
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def main():
    source = ROOT / "build"
    destination = ROOT / "public"
    if destination.is_symlink():
        raise SystemExit("public/ must not be a symbolic link")
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir()

    decks = {"1A": "lecture-1A", "1B": "lecture-1B"}
    for original, published in decks.items():
        shutil.copytree(source / original, destination / published)
    for directory in ["theme", "widgets", "vendor"]:
        shutil.copytree(source / directory, destination / directory)

    index = (source / "index.html").read_text()
    index = re.sub(
        r'^.*<li><a href="(?:demo/|widgets/gallery\.html)">.*</li>\n',
        "",
        index,
        flags=re.MULTILINE,
    )
    for original, published in decks.items():
        index = index.replace(f'href="{original}/"', f'href="{published}/"')
    (destination / "index.html").write_text(index)
    (destination / "widgets/gallery.html").unlink()

    pages = "\n".join(
        (destination / published / "index.html").read_text()
        for published in decks.values()
    )
    if "<slt-level-set" in pages:
        raise SystemExit("The level-set widget is now used; include it in the export")
    widgets_index = destination / "widgets/index.js"
    widgets_index.write_text(
        widgets_index.read_text().replace('import "./slt-level-set.js";\n', "")
    )
    (destination / "widgets/slt-level-set.js").unlink()

    used_ornaments = set(re.findall(r'data-ornament="([^"]+)"', pages))
    stylesheet = destination / "theme/slt.css"
    css = stylesheet.read_text()
    for ornament in (destination / "theme/ornaments").glob("*.svg"):
        if ornament.stem not in used_ornaments:
            css = re.sub(
                r'\.reveal section\[data-ornament="'
                + re.escape(ornament.stem)
                + r'"\] \{[^{}]*\}\n',
                "",
                css,
            )
            ornament.unlink()
    stylesheet.write_text(css)
    print(f"Exported lectures to {destination}")


if __name__ == "__main__":
    main()
