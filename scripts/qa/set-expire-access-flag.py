from pathlib import Path

p = Path(r"D:\auvora-wallet\artifacts\qa-flutter-prefs.xml")
t = p.read_text(encoding="utf-8")
key = "flutter.auvora_qa_expire_access_once_v1"
if key in t:
    print("FLAG_ALREADY_PRESENT")
else:
    t = t.replace("</map>", f'    <boolean name="{key}" value="true" />\n</map>')
    p.write_text(t, encoding="utf-8")
    print("FLAG_INSERTED")
