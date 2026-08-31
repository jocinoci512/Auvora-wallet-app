import re
import pathlib
import sys

t = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8", errors="ignore")
print("EDIT_COUNT", t.count("EditText"))
for m in re.finditer(r'class="android.widget.EditText"[^>]*>', t):
    tag = m.group(0)
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
    h = re.search(r'hint="([^"]*)"', tag)
    d = re.search(r'content-desc="([^"]*)"', tag)
    print("EDIT", b.groups() if b else None, "hint=", h.group(1) if h else "", "desc=", d.group(1) if d else "")
