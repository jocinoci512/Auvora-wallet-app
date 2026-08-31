import re
import pathlib
import sys

sys.stdout.reconfigure(encoding="utf-8")
p = pathlib.Path(sys.argv[1])
t = p.read_text(encoding="utf-8", errors="ignore")
print("TEXTS:")
for x in re.findall(r'text="([^"]+)"', t):
    if x.strip():
        print(" ", x)
print("DESCS:")
for x in re.findall(r'content-desc="([^"]+)"', t):
    if x.strip():
        print(" ", x)
print("BOUNDS:")
for m in re.finditer(
    r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', t
):
    if m.group(1).strip():
        print(f"  {m.group(1)} @ {m.group(2)},{m.group(3)}")
