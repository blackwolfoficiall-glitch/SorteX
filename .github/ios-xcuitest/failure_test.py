"""Portable checks for prelaunch, observed phases, and redaction."""

import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
from failure import TEST, observed_phase, private_fixture_log, result_case, startup_hint

ROOT = Path(__file__).resolve().parent
PRIVATE = "SYNTHETIC_PRIVATE_SENTINEL"


def cases(*cases_):
    return {"testNodes": [{"nodeType": "Test Suite", "children": list(cases_)}]}


def expected_case(result="Failed"):
    return {"nodeType": "Test Case", "nodeIdentifier": TEST, "result": result,
            "details": PRIVATE}


class FailureDiagnostic(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.base = Path(temp.name)
        self.run = self.base / "sortex-xcuitest.fixture"
        self.run.mkdir()
        self.result = self.run / "Test.xcresult"
        self.console = self.run / "test.log"
        self.fixture = self.base / "sortex-ios-ui.fixture"
        self.fixture.mkdir(mode=0o700)
        self.log = self.fixture / "api.log"
        self.report = self.base / "sortex-xcuitest-failure.txt"

    def test_api_log_must_be_only_the_private_fixture_log(self):
        self.log.write_text(PRIVATE)
        self.assertEqual(private_fixture_log(str(self.log), self.base), str(self.log))
        self.assertIsNone(private_fixture_log(str(self.log), self.base / "other"))
        self.fixture.chmod(0o755)
        self.assertIsNone(private_fixture_log(str(self.log), self.base))
        self.fixture.chmod(0o700)
        other = self.base / "api.log"
        other.write_text(PRIVATE)
        self.log.unlink()
        self.log.symlink_to(other)
        self.assertIsNone(private_fixture_log(str(self.log), self.base))
        self.log.unlink()
        self.log.write_text(PRIVATE)
        symlink = self.base / "sortex-ios-ui.symlink"
        symlink.symlink_to(self.fixture, target_is_directory=True)
        self.assertIsNone(private_fixture_log(str(symlink / "api.log"), self.base))

    def test_case_must_be_exact_and_unique(self):
        self.assertEqual(result_case(cases(expected_case())), ("failed", True))
        self.assertEqual(result_case(cases(expected_case("Passed"))), ("passed", True))
        self.assertEqual(result_case(cases(expected_case(PRIVATE))), ("unclassified", True))
        self.assertEqual(result_case(cases()), ("no-test-cases", False))
        self.assertEqual(result_case(cases(expected_case(), expected_case())), ("unexpected-test-inventory", False))
        other = expected_case() | {"nodeIdentifier": "Other/" + TEST.split("/")[-1]}
        self.assertEqual(result_case(cases(other)), ("unexpected-test-inventory", False))
        self.assertEqual(result_case({"testNodes": "bad"}), ("unreadable-test-results", False))

    def test_only_exact_controlled_activity_titles_count(self):
        data = {"testRuns": [{"activities": [
            {"title": "sortex-startup", "childActivities": [
                {"title": PRIVATE}, {"title": "sortex-email"}, {"title": "sortex-password "},
            ]},
            {"title": PRIVATE, "failureSummaries": [{"name": "sortex-campaign"}]},
        ]}]}
        self.assertEqual(observed_phase(data), "email")
        self.assertEqual(observed_phase({"activities": [{"name": "sortex-login"}]}), "login")
        self.assertEqual(observed_phase({"activities": [{"title": "sortex-email: " + PRIVATE}]}), "not-observed")
        self.assertEqual(observed_phase({"testRuns": []}), "not-observed")
        for phase in ("email-tap", "email-keyboard", "email-type", "email-prefix-mismatch",
                      "email-readback",
                      "email-readback-unavailable", "email-readback-mismatch",
                      "campaign-home-ready", "campaign-tab-discover",
                      "campaign-tab-actionable", "campaign-tab-tap",
                      "campaign-tab-selected", "campaign-screen-visible"):
            with self.subTest(phase=phase):
                self.assertEqual(observed_phase({"activities": [
                    {"title": "sortex-" + phase}, {"title": "sortex-email"},
                    {"title": "sortex-" + phase + " " + PRIVATE},
                ]}), phase)
        self.assertEqual(observed_phase({"testRuns": [{}, {}]}), "activities-unreadable")
        self.assertEqual(observed_phase(None), "activities-unreadable")

    def test_email_readback_reports_only_declared_fixed_mismatch_classes(self):
        swift = (ROOT / "BuyerJourneys.swift").read_text()
        enum = swift.split("private enum EmailReadbackFailure", 1)[1].split("\n    }", 1)[0]
        labels = set(re.findall(r' = "sortex-(email-readback-[a-z-]+)"', enum))
        self.assertEqual(labels, {
            "email-readback-unavailable", "email-readback-label", "email-readback-normalization",
            "email-readback-leading-dropped", "email-readback-trailing-dropped",
            "email-readback-edge-truncated", "email-readback-extra-text", "email-readback-mismatch",
        })
        for label in labels:
            with self.subTest(label=label):
                data = {"testRuns": [{"activities": [
                    {"title": "sortex-email-readback", "childActivities": [
                        {"title": "sortex-" + label}, {"title": "sortex-" + label + "-" + PRIVATE},
                    ]},
                ]}]}
                self.assertEqual(observed_phase(data), label)

    def test_console_hints_only_return_fixed_labels(self):
        for message, expected in (
            ("xcodebuild: error: Unable to find a destination matching " + PRIVATE, "invalid-destination"),
            ("Failed to launch the test runner " + PRIVATE, "runner-launch-failed"),
            ("Test bundle " + PRIVATE + " could not be loaded", "test-bundle-missing"),
            ("Code signature validation failed " + PRIVATE, "signing-or-install"),
            ("Failed to load the xctestrun " + PRIVATE, "test-specification"),
            (PRIVATE, "not-observed"),
        ):
            with self.subTest(expected=expected):
                self.console.write_text(message)
                self.assertEqual(startup_hint(self.console), expected)

    def run_fake(self, test_tree=None, activity_tree=None, fixture_event=None, failure=None):
        if test_tree is not None:
            self.result.mkdir()
        bindir = self.base / "bin"
        bindir.mkdir(exist_ok=True)
        tests = self.base / "tests.json"
        tests.write_text(json.dumps(test_tree))
        activities = self.base / "activities.json"
        activities.write_text(json.dumps(activity_tree))
        fake = bindir / "xcrun"
        fake.write_text('''#!/usr/bin/env bash
set -euo pipefail
[[ "$#" -ge 7 && "$1" == xcresulttool && "$2" == get && "$3" == test-results &&
   "$5" == --path && "$6" == "$EXPECTED_RESULT" ]]
printf '%s\\n' "$PRIVATE_SENTINEL" >&2
case "$4" in
  tests)
    [[ "$#" == 7 && "$7" == --compact ]]
    [[ "${FAKE_FAILURE:-}" != tests ]]
    cat "$TEST_DATA"
    ;;
  activities)
    [[ "$#" == 9 && "$7" == --test-id && "$8" == "$EXPECTED_CASE" && "$9" == --compact ]]
    printf '%s\\n' queried >"$QUERY_MARKER"
    [[ "${FAKE_FAILURE:-}" != activities ]]
    cat "$ACTIVITY_DATA"
    ;;
  *) exit 92 ;;
esac
''')
        fake.chmod(0o700)
        if fixture_event is None:
            self.log.write_text("")
        else:
            events = fixture_event if isinstance(fixture_event, list) else [fixture_event]
            self.log.write_text("".join(json.dumps(event) + "\n" for event in events))
        cmd = ["bash", "-c", 'python3 -B "$1" "$2" "$3"', "fake-shell",
               str(ROOT / "failure.py"), str(self.result), str(self.console)]
        env = {"PATH": str(bindir) + os.pathsep + os.environ["PATH"],
               "RUNNER_TEMP": str(self.base), "GITHUB_SHA": "a" * 40,
               "EXPECTED_RESULT": str(self.result), "EXPECTED_CASE": TEST,
               "PRIVATE_SENTINEL": PRIVATE, "TEST_DATA": str(tests), "ACTIVITY_DATA": str(activities),
               "QUERY_MARKER": str(self.base / "queried"), "SORTEX_IOS_UI_API_LOG": str(self.log),
               "FAKE_FAILURE": failure or ""}
        result = subprocess.run(cmd, env=env, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(result.stdout + result.stderr, "")
        report = self.report.read_text()
        self.assertNotIn(PRIVATE, report)
        self.assertNotIn(str(self.base), report)
        self.assertEqual(self.report.stat().st_mode & 0o777, 0o600)
        return report

    def test_shell_captures_only_known_case_and_redacted_login_status(self):
        self.console.write_text("No signing certificate " + PRIVATE)
        report = self.run_fake(cases(expected_case()), {"testRuns": [{"activities": [
            {"title": "sortex-startup"}, {"title": "sortex-email"},
            {"title": "sortex-login", "attachments": [{"name": PRIVATE}]},
        ]}]}, {"event": "sortex-ios-fixture-login-shape", "input": "matches", "status": 200,
               "ignored-unknown-field": PRIVATE})
        self.assertEqual(report, "sha=" + "a" * 40 + "\nxcui-outcome=failed\nxcui-last-phase=login\n"
                         "xcui-launch-hint=not-applicable\nlogin-api=2xx\nlogin-input=matches\n"
                         "buyer-home-api=not-seen\ncampaign-list-api=not-seen\ncampaign-detail-api=not-seen\n")
        self.assertTrue((self.base / "queried").exists())

    def test_native_campaign_substage_and_only_fixed_read_routes(self):
        activity = {"testRuns": [{"activities": [
            {"title": "sortex-campaign-tab"}, {"title": "sortex-campaign-list"},
            {"title": "sortex-campaign-open"}, {"title": "sortex-campaign-detail"},
            {"title": "sortex-campaign-prize", "failure": PRIVATE},
        ]}]}
        report = self.run_fake(cases(expected_case()), activity, [
            {"method": "GET", "path": "/buyer/home?untrusted=" + PRIVATE, "status": 200},
            {"method": "GET", "path": "/buyer/home/wrong", "status": 401},
            {"method": "GET", "path": "/buyer/campaigns?page=1&limit=15&private=" + PRIVATE, "status": 200},
            {"method": "GET", "path": "/buyer/campaigns/other", "status": 500},
            {"method": "GET", "path": "/public/campaigns/campanha-sintetica-ios", "status": 404},
            {"method": "GET", "path": "/public/campaigns/campanha-sintetica-ios", "status": 200},
            {"method": "POST", "path": "/buyer/campaigns", "status": 404},
        ])
        self.assertIn("xcui-last-phase=campaign-prize\n", report)
        self.assertIn("buyer-home-api=2xx\n", report)
        self.assertIn("campaign-list-api=2xx\n", report)
        self.assertIn("campaign-detail-api=mixed\n", report)

    def test_shell_distinguishes_missing_bundle_from_empty_test_inventory(self):
        self.console.write_text("Failed to launch the test runner " + PRIVATE)
        no_bundle = self.run_fake()
        self.assertIn("xcui-outcome=no-result-bundle\n", no_bundle)
        self.assertIn("xcui-launch-hint=runner-launch-failed\n", no_bundle)
        self.assertIn("login-api=not-seen\n", no_bundle)
        self.assertFalse((self.base / "queried").exists())
        self.report.unlink()
        no_tests = self.run_fake(cases())
        self.assertIn("xcui-outcome=no-test-cases\n", no_tests)
        self.assertIn("xcui-last-phase=not-observed\n", no_tests)
        self.assertFalse((self.base / "queried").exists())

    def test_shell_has_fixed_fallback_when_apple_activities_are_unavailable(self):
        report = self.run_fake(cases(expected_case()), failure="activities")
        self.assertIn("xcui-outcome=failed\n", report)
        self.assertIn("xcui-last-phase=activities-unreadable\n", report)
        self.assertIn("xcui-launch-hint=not-observed\n", report)


if __name__ == "__main__":
    unittest.main()
