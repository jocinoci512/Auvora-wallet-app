import pathlib
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
t = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8", errors="ignore")
for m in re.finditer(
    r'content-desc="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', t
):
    label = m.group(1).strip()
    if not label:
        continue
    cx = (int(m.group(2)) + int(m.group(4))) // 2
    cy = (int(m.group(3)) + int(m.group(5))) // 2
    print(f"{cx},{cy}\t{label.replace(chr(10), ' / ')[:120]}")
