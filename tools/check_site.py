#!/usr/bin/env python3
"""Check local page references, fragments and language/navigation contracts."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.path = path
        self.ids = []
        self.references = []
        self.controls = []
        self.lang = None
        self.feed(path.read_text())

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        line = self.getpos()[0]
        if tag == "html":
            self.lang = attributes.get("lang")
        if "id" in attributes:
            self.ids.append(attributes["id"])
        if "aria-controls" in attributes:
            self.controls.append((line, attributes["aria-controls"]))
        for key in ("href", "src"):
            if key in attributes:
                self.references.append((line, tag, attributes[key], attributes.get("data-lang")))
        if tag == "meta" and attributes.get("property") == "og:image":
            self.references.append((line, tag, attributes["content"], None))


def main():
    excluded = {".git", "node_modules", "vendor", ".venv"}
    pages = {path.resolve(): Page(path) for path in ROOT.rglob("*.html")
             if not excluded.intersection(path.relative_to(ROOT).parts)}
    errors = []
    count = 0
    for path, page in pages.items():
        name = path.relative_to(ROOT)
        errors.extend(f"{name}: duplicate id {key}" for key, total in Counter(page.ids).items() if total > 1)
        for line, controls in page.controls:
            for target in controls.split():
                if target not in page.ids:
                    errors.append(f"{name}:{line}: aria-controls target missing: {target}")
        for line, tag, reference, choice in page.references:
            url = urlsplit(reference)
            if (url.scheme or url.netloc) and url.netloc != "neureps.com":
                continue
            count += 1
            target = ((ROOT / unquote(url.path).lstrip("/")) if url.path.startswith("/")
                      else path.parent / unquote(url.path)) if url.path else path
            if target.is_dir():
                target /= "index.html"
            target = target.resolve()
            if not target.is_file():
                errors.append(f"{name}:{line}: missing local reference {reference}")
                continue
            destination = pages.get(target)
            if destination and url.fragment and unquote(url.fragment) not in destination.ids:
                errors.append(f"{name}:{line}: missing fragment {reference}")
            if tag == "a" and destination and destination.lang != page.lang and choice != destination.lang:
                errors.append(f"{name}:{line}: language link needs data-lang={destination.lang}: {reference}")
    css = ROOT / "assets/style.css"
    for reference in re.findall(r'url\(["\']?([^\)"\']+)', css.read_text()):
        path = urlsplit(reference).path
        if path.startswith("/") and not (ROOT / path.lstrip("/")).is_file():
            errors.append(f"{css.name}: missing asset {reference}")
    for error in errors:
        print(error)
    print(f"Checked {len(pages)} pages and {count} local references: {len(errors)} errors.")
    return int(bool(errors))


if __name__ == "__main__":
    raise SystemExit(main())
