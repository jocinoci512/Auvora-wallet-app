import html
import json
import re
from pathlib import Path

prefs = Path(r"D:\auvora-wallet\artifacts\qa-flutter-prefs.xml").read_text(encoding="utf-8")
match = re.search(r"flutter\.auvora_portfolio_cache_v3_testnet\">(.*?)</string>", prefs, re.S)
if not match:
    raise SystemExit("portfolio cache not found")
data = json.loads(html.unescape(match.group(1)))
target = "0xb76fd4160505fa5a9f298bc312073a1278fad6d495b98b1a0fa15c381687f35f"
for tx in data.get("transactions", []):
    if tx.get("hash", "").lower() == target:
        print(json.dumps(tx, indent=2))
        break
else:
    print("tx not found in portfolio cache")

inbox_match = re.search(r"flutter\.auvora_notif_inbox_v1\">(.*?)</string>", prefs, re.S)
if inbox_match:
    inbox = json.loads(html.unescape(inbox_match.group(1)))
    completed = [n for n in inbox if "tx-completed" in n.get("id", "")]
    print("completed_notifs", len(completed))
    for n in completed[:3]:
        print(json.dumps(n, indent=2))
