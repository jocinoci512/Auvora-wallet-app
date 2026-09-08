import subprocess
from pathlib import Path

import os
adb = r"E:\AuvoraPortable\Android\Sdk\platform-tools\adb.exe" if os.path.exists(r"E:\AuvoraPortable\Android\Sdk\platform-tools\adb.exe") else r"D:\Android\Sdk\platform-tools\adb.exe"
out = Path(r"D:\auvora-wallet\artifacts\qa-flutter-prefs.xml")
raw = subprocess.check_output(
    [
        adb,
        "-s",
        "R5CW51ZMNLB",
        "exec-out",
        "run-as",
        "com.auvora.auvora_wallet.qa",
        "cat",
        "shared_prefs/FlutterSharedPreferences.xml",
    ]
)
if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
    text = raw.decode("utf-16")
else:
    text = raw.decode("utf-8")
out.write_text(text, encoding="utf-8")
print("BYTES", len(raw), "CHARS", len(text))
print("HAS_EXPIRE", "auvora_qa_expire_access_once_v1" in text)
print("HAS_LAST_REVIEW", "auvora_last_transfer_review_id_v1" in text)
print("HAS_ONBOARDED", "auvora_onboarded_v1" in text)
