from pathlib import Path

p = Path(r"D:\auvora-wallet\artifacts\qa-flutter-prefs.xml")
t = p.read_text(encoding="utf-8")
# Drop last review so Send starts a new prepare (does not delete backend reviews).
t = t.replace(
    '    <string name="flutter.auvora_last_transfer_review_id_v1">89970795-e800-4b23-b72d-e3913822ef59</string>\n',
    "",
)
key = "flutter.auvora_qa_expire_access_once_v1"
if key not in t:
    t = t.replace("</map>", f'    <boolean name="{key}" value="true" />\n</map>')
p.write_text(t, encoding="utf-8")
print("PREFS_READY")
print("HAS_EXPIRE", key in t)
print("HAS_LAST_REVIEW", "auvora_last_transfer_review_id_v1" in t)
