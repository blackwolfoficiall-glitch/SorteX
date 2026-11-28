"""Portable checks; macOS is required for the actual experiment."""

from contextlib import redirect_stdout
from io import StringIO
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import control

HERE = Path(__file__).resolve().parent
PRIVATE = "PRIVATE_SENTINEL"
TEMP_ID = "00000000-0000-0000-0000-000000000001"


def test_case(mode, result):
    return {"nodeType": "Test Case", "nodeIdentifier": control.TEST_IDS[mode] + "()",
            "result": result, "ignored": PRIVATE}


def tree(*cases):
    return {"testNodes": [{"children": [{"children": list(cases)}]}]}


class ControlTests(unittest.TestCase):
    def test_available_is_exact_and_missing_runtime_or_model_fails(self):
        supported = {"identifier": control.RUNTIME, "version": "26.5", "isAvailable": True}
        self.assertTrue(control.runtime_available({"runtimes": [supported]}))
        for invalid in ({"isAvailable": False}, {"isAvailable": "true"}, {"version": "26.6"},
                        {"identifier": PRIVATE}):
            self.assertFalse(control.runtime_available({"runtimes": [supported | invalid]}))
        device = {"identifier": control.MODEL, "name": "iPhone 17"}
        self.assertTrue(control.model_available({"devicetypes": [device]}))
        self.assertFalse(control.model_available({"devicetypes": [device | {"name": "iPhone 17 Pro"}]}))

    def test_verifies_exact_new_booted_device(self):
        row = {"udid": TEMP_ID, "name": control.DEVICE_NAME, "deviceTypeIdentifier": control.MODEL,
               "state": "Booted", "isAvailable": True}
        self.assertTrue(control.verify_device({"devices": {control.RUNTIME: [row]}}, TEMP_ID))
        self.assertFalse(control.verify_device({"devices": {"wrong": [row]}}, TEMP_ID))
        self.assertFalse(control.verify_device({"devices": {control.RUNTIME: [row, row]}}, TEMP_ID))
        for invalid in ({"name": PRIVATE}, {"state": "Shutdown"}, {"deviceTypeIdentifier": PRIVATE}):
            self.assertFalse(control.verify_device({"devices": {control.RUNTIME: [row | invalid]}}, TEMP_ID))

    def test_reuses_verified_spec_without_injecting_credentials_and_disables_attachments(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory + control.APP_SUFFIX)
            app.mkdir(parents=True)
            base = {"BlueprintName": "SortexFixtureUITests",
                    "TestBundlePath": "__TESTHOST__/PlugIns/SortexFixtureUITests.xctest",
                    "TestHostPath": "__TESTROOT__/Debug/SortexFixtureUITests-Runner.app",
                    "EnvironmentVariables": {"DROP": PRIVATE},
                    "UITargetAppEnvironmentVariables": {"DROP": PRIVATE}}
            document = {"SortexFixtureUITests": {**base}}
            target = control.setup(document, app)["SortexFixtureUITests"]
            self.assertEqual(target["OnlyTestIdentifiers"], list(control.TEST_IDS.values()))
            self.assertEqual(target["EnvironmentVariables"], {})
            self.assertEqual(target["UITargetAppEnvironmentVariables"], {})
            self.assertEqual(target["SystemAttachmentLifetime"], "keepNever")
            self.assertEqual(target["UserAttachmentLifetime"], "keepNever")
            self.assertFalse(target["ParallelizationEnabled"])
            self.assertNotIn(PRIVATE, str(target))
            with self.assertRaises(ValueError):
                control.setup({"SortexFixtureUITests": base | {
                    "EnvironmentVariables": {control.PASSWORD_KEY: PRIVATE},
                }}, app)

    def test_excludes_wrong_duplicate_or_nonexact_test_inventory(self):
        passed = test_case("chunks-a", "Passed")
        failed = test_case("characters-a", "Failed")
        self.assertEqual(control.inventory(tree(passed, failed)), {
            control.TEST_IDS["chunks-a"]: "exact", control.TEST_IDS["characters-a"]: "failed",
        })
        self.assertEqual(control.inventory(tree(passed, passed)), {})
        self.assertEqual(control.inventory(tree(failed | {"nodeIdentifier": PRIVATE})), {})
        self.assertEqual(control.inventory(tree(failed | {
            "nodeIdentifier": "BuyerEmailInputControls/testBulk()",
        })), {})

    def test_comparison_requires_both_lanes_and_repeated_exact_readback(self):
        exact = dict.fromkeys(control.TEST_IDS, "exact")
        self.assertEqual(control.comparison(exact, {}), "both-repeatable")
        for loser, result in (
            ("chunks-a", "characters-repeatable"), ("chunks-b", "characters-repeatable"),
            ("characters-a", "chunks-repeatable"), ("characters-b", "chunks-repeatable"),
        ):
            for phase in ("prefix", "readback"):
                self.assertEqual(control.comparison(exact | {loser: "failed"}, {loser: phase}), result)
        mixed = exact | {"chunks-b": "failed", "characters-a": "failed"}
        self.assertEqual(control.comparison(mixed, {
            "chunks-b": "prefix", "characters-a": "readback",
        }), "neither-repeatable")
        for early in ("keyboard", "tap", "type", "fresh-input", "unknown"):
            self.assertEqual(control.comparison(exact | {"chunks-a": "failed"}, {"chunks-a": early}),
                             "indeterminate")
        for result in ("skipped", "unknown", "not-observed", None):
            self.assertEqual(control.comparison(exact | {"characters-b": result}, {}), "indeterminate")
        self.assertEqual(control.comparison({"chunks-a": "exact"}, {}), "indeterminate")

    def test_reports_fixed_classifications_only_and_queries_exact_case(self):
        private_results = [
            tree(*[test_case(mode, "Failed" if mode == "chunks-a" else "Passed")
                   for mode in control.TEST_IDS]),
            {"testRuns": [{"activities": [
                {"title": "input-control-type"}, {"title": "input-control-prefix"},
                {"title": PRIVATE, "subactivities": [{"title": PRIVATE}]},
            ]}]},
        ]
        output = StringIO()
        with patch.object(control, "json_command", side_effect=private_results) as command:
            with redirect_stdout(output):
                self.assertEqual(control.report(Path("/tmp/Control.xcresult")), "characters-repeatable")
        self.assertEqual(output.getvalue(), (
            "chunks-a=failed\nchunks-a-last-phase=prefix\n"
            "characters-a=exact\ncharacters-a-last-phase=unknown\n"
            "chunks-b=exact\nchunks-b-last-phase=unknown\n"
            "characters-b=exact\ncharacters-b-last-phase=unknown\n"
            "comparison=characters-repeatable\n"
        ))
        self.assertIn(control.TEST_IDS["chunks-a"] + "()", command.call_args_list[1].args[0])
        self.assertEqual(command.call_count, 2)
        self.assertNotIn(PRIVATE, output.getvalue())

    def test_control_relaunches_real_input_without_submitting_or_observing_password(self):
        swift = (HERE / "BuyerEmailInputControls.swift").read_text()
        self.assertIn('app.textFields["sortex-login-email"]', swift)
        self.assertIn("app.terminate()", swift)
        self.assertIn("app.launch()", swift)
        self.assertIn("value == nil || (value as? String)?.isEmpty == true", swift)
        self.assertIn("readsExactly(expectedPrefix, from: email)", swift)
        self.assertIn("for character in expected", swift)
        self.assertIn("typeNext(String(character), prefix: &prefix, into: email)", swift)
        self.assertIn("typeNext(chunk, prefix: &prefix, into: email)", swift)
        self.assertIn("continueAfterFailure = false", swift)
        self.assertLess(swift.index("email.typeText(chunk)"), swift.index("readsExactly(expectedPrefix, from: email)"))
        for case in control.TEST_IDS.values():
            self.assertIn("func " + case.rsplit("/", 1)[1] + "()", swift)
        self.assertIn("readsExactly(expected, from: email)", swift)
        self.assertEqual(swift.count("func test"), 4)
        self.assertEqual(swift.count("observe(paced: true)"), 2)
        self.assertEqual(swift.count("observe(paced: false)"), 2)
        self.assertEqual(swift.count("typeText("), 1)
        for bypass in ("submit.tap", "secret.typeText", "secret.value", "openURL", "UIPasteboard",
                       "screenshot(", "debugDescription", "print("):
            self.assertNotIn(bypass, swift)

    def test_shell_refuses_unapproved_context_or_any_fixture_credentials(self):
        launcher = ["bash", str(HERE / "run.sh")]
        with tempfile.TemporaryDirectory() as directory:
            env = {
                "PATH": os.environ["PATH"], "RUNNER_TEMP": directory, "GITHUB_SHA": "f" * 40,
                "RUNNER_OS": "macOS", "GITHUB_REPOSITORY": "blackwolfoficiall-glitch/SorteX",
                "GITHUB_REF": "refs/heads/homologacao/web-ios-integrada", "GITHUB_EVENT_NAME": "push",
                "SORTEX_IOS_INPUT_CONTROL": "1", "EXPO_PUBLIC_API_URL": "http://127.0.0.1:3338",
                "EXPO_PUBLIC_ALLOW_LOCAL_API": "1", "EXPO_PUBLIC_ENABLE_TEST_RESERVATIONS": "0",
                "EXPO_NO_DOTENV": "1",
            }
            for override in (
                {"SORTEX_IOS_INPUT_CONTROL": ""}, {"GITHUB_REF": "refs/heads/main"},
                {"EXPO_PUBLIC_API_URL": "https://qa.example.test"}, {"DATABASE_URL": PRIVATE},
                {"SORTEX_XCUI_FIXTURE_PASSWORD": PRIVATE}, {"SORTEX_IOS_UI_BUYER_PASSWORD": PRIVATE},
            ):
                result = subprocess.run(launcher, env=env | override, capture_output=True, text=True)
                self.assertEqual(result.returncode, 64)
                self.assertEqual(result.stdout + result.stderr, "")
                self.assertFalse(list(Path(directory).iterdir()))

    def test_workflow_is_explicitly_separate_and_no_artifact_leak(self):
        workflow = (HERE.parent / "workflows/mobile-native-input-controls.yml").read_text()
        original = (HERE.parent / "workflows/mobile-native-xcuitest.yml").read_text()
        script = (HERE / "run.sh").read_text()
        self.assertIn("[xcui-input-control] ", workflow)
        self.assertIn("github.event.repository.private == false", workflow)
        self.assertNotIn(".github/ios-xcuitest-input-controls", original)
        self.assertEqual(workflow.count("actions/upload-artifact"), 1)
        self.assertIn("path: ${{ runner.temp }}/sortex-native-input-control.txt", workflow)
        for disallowed in ("with-fixture.sh", "postgresql", "DATABASE_URL", "secrets.", ".xcresult", ".png"):
            self.assertNotIn(disallowed, workflow)
        self.assertIn("simctl create SortexInputControl", script)
        self.assertIn("deviceTypeIdentifier", (HERE / "control.py").read_text())
        self.assertIn("!= false", (HERE / "BuyerEmailInputControls.swift").read_text())
        self.assertEqual(subprocess.run(["bash", "-n", str(HERE / "run.sh")]).returncode, 0)


if __name__ == "__main__":
    unittest.main()
