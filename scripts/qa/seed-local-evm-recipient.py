"""Add LOCAL QA recipient contact to Flutter SharedPreferences (no secrets)."""
import json
import re
import subprocess
from pathlib import Path

import os
ADB = r"E:\AuvoraPortable\Android\Sdk\platform-tools\adb.exe" if os.path.exists(r"E:\AuvoraPortable\Android\Sdk\platform-tools\adb.exe") else r"D:\Android\Sdk\platform-tools\adb.exe"
SERIAL = "R5CW51ZMNLB"
PKG = "com.auvora.auvora_wallet.qa"
OUT = Path(r"D:\auvora-wallet\artifacts\qa-flutter-prefs.xml")
RECIPIENT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
CONTACT = {
    "id": "qa-local-evm-recipient",
    "name": "Local QA recipient",
    "address": RECIPIENT,
    "network": "ethereum",
    "favorite": True,
    "lastUsed": None,
    "walletLabel": "LOCAL QA ONLY",
    "notes": "Auvora Local EVM QA deterministic Anvil account #1",
}


def pull() -> str:
    raw = subprocess.check_output(
        [ADB, "-s", SERIAL, "exec-out", "run-as", PKG, "cat", "shared_prefs/FlutterSharedPreferences.xml"]
    )
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        return raw.decode("utf-16")
    return raw.decode("utf-8")


def main() -> None:
    text = pull()
    m = re.search(
        r'<string name="flutter\.auvora_contacts_v1">(.*?)</string>',
        text,
        re.DOTALL,
    )
    contacts = []
    if m:
        raw = m.group(1).replace("&quot;", '"').replace("&amp;", "&")
        contacts = json.loads(raw)
        contacts = [c for c in contacts if c.get("id") != CONTACT["id"]]
    contacts.insert(0, CONTACT)
    encoded = json.dumps(contacts, separators=(",", ":")).replace("&", "&amp;").replace('"', "&quot;")
    new_tag = f'<string name="flutter.auvora_contacts_v1">{encoded}</string>'
    if m:
        text = text[: m.start()] + new_tag + text[m.end() :]
    else:
        text = text.replace("</map>", f"    {new_tag}\n</map>")
    # Drop last review so Send starts fresh prepare
    text = re.sub(
        r'\s*<string name="flutter\.auvora_last_transfer_review_id_v1">[^<]*</string>\s*',
        "\n",
        text,
    )
    OUT.write_text(text, encoding="utf-8")
    subprocess.check_call(
        [ADB, "-s", SERIAL, "push", str(OUT), "/data/local/tmp/FlutterSharedPreferences.xml"]
    )
    subprocess.check_call(
        [
            ADB,
            "-s",
            SERIAL,
            "shell",
            f"run-as {PKG} cp /data/local/tmp/FlutterSharedPreferences.xml shared_prefs/FlutterSharedPreferences.xml",
        ]
    )
    print("CONTACT_READY", RECIPIENT)


if __name__ == "__main__":
    main()
