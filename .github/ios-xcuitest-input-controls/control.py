"""Only fixed preflight and exact-case categories leave the private Xcode files."""

import json
from pathlib import Path
import os
import plistlib
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "ios-xcuitest"))
from evidence import APP_SUFFIX, PASSWORD_KEY, selected_target, validate_target
from failure import json_command

RUNTIME = "com.apple.CoreSimulator.SimRuntime.iOS-26-5"
MODEL = "com.apple.CoreSimulator.SimDeviceType.iPhone-17"
DEVICE_NAME = "SortexInputControl"
TEST_IDS = {
    "chunks-a": "BuyerEmailInputControls/testAChunks",
    "characters-a": "BuyerEmailInputControls/testBCharacters",
    "chunks-b": "BuyerEmailInputControls/testCChunks",
    "characters-b": "BuyerEmailInputControls/testDCharacters",
}
PHASES = ("signed-out", "fresh-input", "tap", "keyboard", "type", "prefix", "readback", "no-submit")


def runtime_available(data):
    return any(row.get("identifier") == RUNTIME and row.get("version") == "26.5"
               and row.get("isAvailable") is True for row in data["runtimes"])


def model_available(data):
    return any(row.get("identifier") == MODEL and row.get("name") == "iPhone 17"
               for row in data["devicetypes"])


def verify_device(data, uid):
    if not re.fullmatch(r"[A-Fa-f0-9]{8}(?:-[A-Fa-f0-9]{4}){3}-[A-Fa-f0-9]{12}", uid):
        return False
    matches = [v for v in data["devices"].get(RUNTIME, []) if v.get("udid") == uid]
    return (len(matches) == 1 and matches[0].get("deviceTypeIdentifier") == MODEL
            and matches[0].get("state") == "Booted" and matches[0].get("isAvailable") is True
            and matches[0].get("name") == DEVICE_NAME)


def setup(spec, app):
    if not app.is_absolute() or not str(app).endswith(APP_SUFFIX) or not app.is_dir():
        raise ValueError("app")
    target = selected_target(spec)
    validate_target(target)
    if PASSWORD_KEY in target.get("TestingEnvironmentVariables", {}):
        raise ValueError("environment")
    target["EnvironmentVariables"] = {}
    target["UITargetAppEnvironmentVariables"] = {}
    target["UITargetAppPath"] = str(app)
    target["UITargetAppBundleIdentifier"] = "br.com.sortex.development"
    target["DependentProductPaths"] = list(dict.fromkeys([*target.get("DependentProductPaths", []), str(app)]))
    target["OnlyTestIdentifiers"] = list(TEST_IDS.values())
    target["SystemAttachmentLifetime"] = "keepNever"
    target["UserAttachmentLifetime"] = "keepNever"
    target["ParallelizationEnabled"] = False
    return spec


def inventory(data):
    if not isinstance(data, dict) or not isinstance(data.get("testNodes"), list):
        return {}
    pending = list(data["testNodes"])
    tests = {}
    while pending:
        item = pending.pop()
        if not isinstance(item, dict) or not isinstance(item.get("children", []), list):
            return {}
        if item.get("nodeType") != "Test Case":
            pending.extend(item.get("children", []))
            continue
        name = item.get("nodeIdentifier")
        if not isinstance(name, str):
            return {}
        name = name.removesuffix("()")
        if name not in TEST_IDS.values() or name in tests:
            return {}
        tests[name] = {"Passed": "exact", "Failed": "failed", "Skipped": "skipped"}.get(
            item.get("result"), "unknown") if isinstance(item.get("result"), str) else "unknown"
    return tests


def last_phase(data):
    if not isinstance(data, dict):
        return "unknown"
    runs = data.get("testRuns")
    if runs is None and isinstance(data.get("activities"), list):
        runs = [data]
    if not isinstance(runs, list) or len(runs) != 1 or not isinstance(runs[0], dict):
        return "unknown"
    pending = runs[0].get("activities", runs[0].get("activityRecords"))
    if not isinstance(pending, list):
        return "unknown"
    # Walk chronologically so a repeated paced type/prefix is classified by
    # its actual final observed operation, without outputting an index.
    pending = list(reversed(pending))
    phase = "unknown"
    names = {"input-control-" + code: code for code in PHASES}
    while pending:
        step = pending.pop()
        if not isinstance(step, dict):
            continue
        title = step.get("title", step.get("name"))
        if isinstance(title, str) and title in names:
            phase = names[title]
        for key in ("childActivities", "subActivities", "subactivities", "children", "activities"):
            children = step.get(key)
            if isinstance(children, list):
                pending.extend(reversed(children))
    return phase


def comparison(outcomes, phases):
    signatures = {}
    for mode in TEST_IDS:
        signatures[mode] = outcomes.get(mode) == "exact"
        if not signatures[mode] and (
            outcomes.get(mode) != "failed" or phases.get(mode) not in {"prefix", "readback"}
        ):
            return "indeterminate"
    chunks_repeatable = signatures["chunks-a"] and signatures["chunks-b"]
    characters_repeatable = signatures["characters-a"] and signatures["characters-b"]
    return {
        (True, True): "both-repeatable", (True, False): "chunks-repeatable",
        (False, True): "characters-repeatable", (False, False): "neither-repeatable",
    }[chunks_repeatable, characters_repeatable]


def report(bundle):
    base = ["xcrun", "xcresulttool", "get", "test-results"]
    found = inventory(json_command([*base, "tests", "--path", str(bundle), "--compact"]))
    outcomes = {key: found.get(case, "not-observed") for key, case in TEST_IDS.items()}
    phases = {}
    for mode, case in TEST_IDS.items():
        outcome = outcomes[mode]
        phase = "unknown"
        if outcome == "failed":
            phase = last_phase(json_command([*base, "activities", "--path", str(bundle),
                                             "--test-id", case + "()", "--compact"]))
        phases[mode] = phase
        print(f"{mode}={outcome}")
        print(f"{mode}-last-phase={phase}")
    status = comparison(outcomes, phases)
    print(f"comparison={status}")
    return status


def main():
    os.umask(0o077)
    mode, *args = sys.argv[1:]
    if mode == "runtime" and not args:
        return 0 if runtime_available(json.load(sys.stdin)) else 64
    if mode == "model" and not args:
        return 0 if model_available(json.load(sys.stdin)) else 64
    if mode == "device" and len(args) == 1:
        return 0 if verify_device(json.load(sys.stdin), args[0]) else 64
    if mode == "spec" and len(args) == 3:
        source, target, app = map(Path, args)
        if source.parent != target.parent or any(p.suffix != ".xctestrun" for p in (source, target)):
            return 64
        with source.open("rb") as stream:
            spec = setup(plistlib.load(stream), app)
        with target.open("xb") as stream:
            plistlib.dump(spec, stream)
        return 0
    if mode == "report" and len(args) == 1:
        result = Path(args[0])
        if not result.is_dir() or result.is_symlink():
            print("comparison=indeterminate")
            return 64
        return 0 if report(result) != "indeterminate" else 64
    return 64


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, AttributeError, TypeError, KeyError, OSError, RecursionError, plistlib.InvalidFileException):
        sys.exit(64)
