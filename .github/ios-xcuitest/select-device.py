"""Select an available iPhone UDID without emitting the simulator inventory."""

import json
import re
import sys

try:
    devices = [
        row for runtime, group in json.load(sys.stdin)["devices"].items() if "iOS" in runtime
        for row in group if row.get("isAvailable") and row.get("name", "").startswith("iPhone")
    ]
    device = next((row for row in devices if row.get("state") == "Booted"), None)
    udid = (device or devices[0])["udid"]
    if not re.fullmatch(r"[A-Fa-f0-9]{8}(?:-[A-Fa-f0-9]{4}){3}-[A-Fa-f0-9]{12}", udid):
        raise ValueError()
    print(udid)
except (KeyError, IndexError, TypeError, AttributeError, ValueError):
    sys.exit("Available iPhone simulator not identified.")
