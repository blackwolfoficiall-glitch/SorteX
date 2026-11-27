"""Turn private XCTest results into a few fixed diagnostic categories."""

import json
import os
from pathlib import Path
import re
import subprocess
import sys

sys.dont_write_bytecode = True
from evidence import TEST

PHASES = (
    "startup", "email", "email-tap", "email-keyboard", "email-type", "email-prefix-mismatch",
    "email-readback",
    "email-readback-unavailable", "email-readback-label", "email-readback-normalization",
    "email-readback-leading-dropped", "email-readback-trailing-dropped",
    "email-readback-edge-truncated", "email-readback-extra-text", "email-readback-mismatch",
    "password", "login",
    "campaign", "campaign-tab",
    "campaign-home-ready", "campaign-tab-discover", "campaign-tab-actionable",
    "campaign-tab-tap", "campaign-tab-selected", "campaign-screen-visible",
    "campaign-list", "campaign-open", "campaign-detail", "campaign-prize",
    "campaign-regulation", "signed-in-relaunch", "logout", "signed-out-relaunch",
)
CASES = {"Failed": "failed", "Passed": "passed", "Skipped": "skipped",
         "Expected Failure": "expected-failure"}
HTTP_STATUS = set("unknown not-seen 2xx 400-validation 401-unauthorized 403-forbidden "
                  "429-rate-limited 4xx-other 5xx".split())
HTTP_INPUT = set("unknown not-seen matches email-mismatch password-mismatch both-mismatch "
                 "missing-email missing-password missing-both".split())
BUYER_READ = {"unknown", "not-seen", "2xx", "non-2xx", "mixed"}
PRELAUNCH_HINTS = (
    ("invalid-destination", r"unable to find a destination matching|ineligible destinations for|no devices matched"),
    ("runner-launch-failed", r"failed to launch (?:the )?test runner|test runner failed to (?:initialize|launch)|"
                             r"could not launch (?:the )?test runner|failed to initialize (?:for )?ui testing"),
    ("test-bundle-missing", r"(?:could not|failed to|unable to) (?:load|find) (?:the )?test bundle|"
                            r"test bundle [^\n]* (?:was not found|does not exist|could not be loaded)"),
    ("signing-or-install", r"no signing certificate|provisioning profile [^\n]* (?:required|not found)|"
                           r"code signature validation failed|failed to install (?:the )?(?:test runner|application)"),
    ("test-specification", r"failed to (?:read|load) (?:the )?xctestrun|"
                           r"(?:invalid|malformed) (?:the )?xctestrun"),
)


def json_command(args):
    """Apple tool stdout/stderr never go to the workflow console or a file."""
    try:
        result = subprocess.run(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, timeout=20, check=True)
        if len(result.stdout) <= 8 * 1024 * 1024:
            return json.loads(result.stdout)
    except (OSError, ValueError, subprocess.SubprocessError, RecursionError):
        pass
    return None


def result_case(tree):
    """Only accept the one exact case; never select by a loose method name."""
    if not isinstance(tree, dict) or not isinstance(tree.get("testNodes"), list):
        return "unreadable-test-results", False
    stack = list(tree["testNodes"])
    cases = []
    while stack:
        node = stack.pop()
        if not isinstance(node, dict) or not isinstance(node.get("children", []), list):
            return "unreadable-test-results", False
        if node.get("nodeType") == "Test Case":
            cases.append(node)
        else:
            stack.extend(node.get("children", []))
    if not cases:
        return "no-test-cases", False
    if len(cases) != 1:
        return "unexpected-test-inventory", False
    node = cases[0]
    identifier = node.get("nodeIdentifier")
    if not isinstance(identifier, str) or identifier.removesuffix("()") != TEST.removesuffix("()"):
        return "unexpected-test-inventory", False
    outcome = node.get("result")
    return (CASES.get(outcome, "unclassified") if isinstance(outcome, str)
            else "unclassified"), True


def observed_phase(tree):
    """Match only the exact activity titles we own, never failure text."""
    if not isinstance(tree, dict):
        return "activities-unreadable"
    runs = tree.get("testRuns")
    # Some versions return a single top-level activity tree.
    if runs is None and isinstance(tree.get("activities"), list):
        runs = [tree]
    if not isinstance(runs, list):
        return "activities-unreadable"
    if not runs:
        return "not-observed"
    if len(runs) != 1 or not isinstance(runs[0], dict):
        return "activities-unreadable"
    activities = runs[0].get("activities", runs[0].get("activityRecords"))
    if not isinstance(activities, list):
        return "activities-unreadable"
    known = {"sortex-" + phase: phase for phase in PHASES}
    seen = set()
    stack = list(activities)
    while stack:
        node = stack.pop()
        if not isinstance(node, dict):
            continue
        for key in ("title", "name"):
            label = node.get(key)
            if isinstance(label, str) and label in known:
                seen.add(known[label])
        for key in ("childActivities", "subActivities", "subactivities", "children", "activities"):
            nested = node.get(key)
            if isinstance(nested, list):
                stack.extend(nested)
    return next((phase for phase in reversed(PHASES) if phase in seen), "not-observed")


def startup_hint(console):
    try:
        with console.open("rb") as stream:
            stream.seek(max(0, console.stat().st_size - 256 * 1024))
            text = stream.read(256 * 1024).decode("utf-8", "replace")
    except OSError:
        return "not-observed"
    return next((label for label, pattern in PRELAUNCH_HINTS if re.search(pattern, text, re.I)),
                "not-observed")


def private_fixture_log(log, runner_temp):
    if not log:
        return None
    path = Path(log)
    parent = path.parent
    try:
        if (not path.is_absolute() or path.name != "api.log"
                or parent.parent != runner_temp or not parent.name.startswith("sortex-ios-ui.")
                or parent.is_symlink() or not parent.is_dir() or parent.stat().st_mode & 0o077
                or path.is_symlink() or not path.is_file()
                or path.resolve().parent.parent != runner_temp.resolve()):
            return None
    except OSError:
        return None
    return str(path)


def api_observation(log):
    # This fixture log already contains allowlisted observer events, not request
    # bodies. Reuse its classifier, then independently recheck both output enums.
    obs = None
    if log:
        classifier = Path(__file__).resolve().parent / "fixture-read-observation.cjs"
        obs = json_command(["node", str(classifier), log])
    if not isinstance(obs, dict):
        obs = {}

    def safe(key, accepted):
        value = obs.get(key)
        return value if isinstance(value, str) and value in accepted else "unknown"

    return (safe("status", HTTP_STATUS), safe("input", HTTP_INPUT),
            safe("home", BUYER_READ), safe("list", BUYER_READ), safe("detail", BUYER_READ))


def diagnose(bundle, console, api_log):
    phase = "not-observed"
    if not bundle.is_dir() or bundle.is_symlink():
        outcome = "no-result-bundle"
    else:
        base = ["xcrun", "xcresulttool", "get", "test-results"]
        tree = json_command([*base, "tests", "--path", str(bundle), "--compact"])
        outcome, known_case = result_case(tree)
        if known_case:
            activities = json_command([*base, "activities", "--path", str(bundle),
                                       "--test-id", TEST, "--compact"])
            phase = observed_phase(activities)
    hint = startup_hint(console) if phase not in PHASES else "not-applicable"
    status, shape, home, campaign_list, campaign_detail = api_observation(api_log)
    return {"xcui-outcome": outcome, "xcui-last-phase": phase, "xcui-launch-hint": hint,
            "login-api": status, "login-input": shape, "buyer-home-api": home,
            "campaign-list-api": campaign_list,
            "campaign-detail-api": campaign_detail}


def main():
    if len(sys.argv) != 3:
        return 64
    os.umask(0o077)
    sha = os.environ.get("GITHUB_SHA", "")
    run_temp = os.environ.get("RUNNER_TEMP", "")
    bundle, console = map(Path, sys.argv[1:])
    if (not re.fullmatch(r"[0-9a-f]{40}", sha) or not run_temp or not Path(run_temp).is_absolute()
            or bundle.name != "Test.xcresult" or console.name != "test.log"
            or bundle.parent != console.parent or bundle.parent.parent != Path(run_temp)
            or not bundle.parent.name.startswith("sortex-xcuitest.") or bundle.parent.is_symlink()
            or console.is_symlink()):
        return 64
    report = Path(run_temp) / "sortex-xcuitest-failure.txt"
    api_log = private_fixture_log(os.environ.get("SORTEX_IOS_UI_API_LOG"), Path(run_temp))
    facts = diagnose(bundle, console, api_log)
    with report.open("x") as stream:
        stream.write(f"sha={sha}\n")
        for label, value in facts.items():
            stream.write(f"{label}={value}\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, RecursionError):
        sys.exit(64)
