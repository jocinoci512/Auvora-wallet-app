import re
import pathlib
import sys

t = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8", errors="ignore")
for m in re.finditer(r'checkable="true"[^>]*>', t):
    tag = m.group(0)
    checked = re.search(r'checked="([^"]+)"', tag)
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
    d = re.search(r'content-desc="([^"]*)"', tag)
    print("checked=", checked.group(1) if checked else "?", "bounds=", b.groups() if b else None, "desc=", (d.group(1) if d else "")[:80])
