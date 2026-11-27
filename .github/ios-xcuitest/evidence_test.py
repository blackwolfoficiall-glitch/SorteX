"""Linux-portable tests for the XCUITest test host's redaction contract."""

import os
from pathlib import Path
import plistlib
import subprocess
import sys
import tempfile
import unittest
from xml.etree import ElementTree

sys.dont_write_bytecode = True
from evidence import APP_SUFFIX, PASSWORD_KEY, TARGET, TEST, configure, verify

ROOT = Path(__file__).resolve().parent
DUMMY = "a" * 48


def target():
    return {
        "BlueprintName": TARGET,
        "TestBundlePath": f"__TESTHOST__/PlugIns/{TARGET}.xctest",
        "TestHostPath": f"__TESTROOT__/Debug-iphonesimulator/{TARGET}-Runner.app",
    }


def v2(*targets):
    return {"__xctestrun_metadata__": {"FormatVersion": 2},
            "TestConfigurations": [{"IsEnabled": True, "TestTargets": list(targets)}]}


def tree(*cases):
    return {"testNodes": [{"children": [{"children": list(cases)}]}]}


def case(identifier=TEST, result="Passed"):
    return {"nodeType": "Test Case", "nodeIdentifier": identifier, "result": result}


class EvidenceGuards(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.app = Path(self.tmp.name + APP_SUFFIX)
        self.app.mkdir(parents=True)

    def test_known_runner_only_in_both_xcode_formats(self):
        for v in (1, 2):
            t = target()
            doc = {TARGET: t} if v == 1 else v2(t)
            self.assertEqual(configure(doc, self.app, DUMMY), doc)
            self.assertEqual(t["EnvironmentVariables"], {PASSWORD_KEY: DUMMY})
            self.assertNotIn("UITargetAppEnvironmentVariables", t)
            self.assertNotIn("UITargetAppCommandLineArguments", t)
            self.assertEqual(t["UITargetAppPath"], str(self.app))
            self.assertEqual(t["SystemAttachmentLifetime"], "keepNever")
            self.assertEqual(t["UserAttachmentLifetime"], "keepNever")
            self.assertEqual(t["OnlyTestIdentifiers"], [TEST.removesuffix("()")])
            self.assertFalse(t["ParallelizationEnabled"])

    def test_rejects_altered_test_specification_or_fixture(self):
        for wrong in (
            {"UITargetAppEnvironmentVariables": {"OTHER": DUMMY}},
            {"UITargetAppCommandLineArguments": [DUMMY]},
            {"TestHostPath": "other.app"},
            {"UseDestinationArtifacts": True},
            {"SkipTestIdentifiers": [TEST]},
            {"EnvironmentVariables": {PASSWORD_KEY: DUMMY}},
            {"TestingEnvironmentVariables": {PASSWORD_KEY: DUMMY}},
        ):
            with self.subTest(wrong=next(iter(wrong))), self.assertRaises(ValueError):
                configure(v2(target() | wrong), self.app, DUMMY)
        for doc in (v2(target(), target()), v2()):
            with self.assertRaises(ValueError):
                configure(doc, self.app, DUMMY)
        with self.assertRaises(ValueError):
            configure(v2(target()), self.base, DUMMY)
        with self.assertRaises(ValueError):
            configure(v2(target()), self.app, "untrusted")

    def test_exactly_one_actual_passing_case_required(self):
        self.assertTrue(verify(tree(case())))
        for result in ("Failed", "Skipped", "Unknown", "Expected Failure"):
            self.assertFalse(verify(tree(case(result=result))))
        self.assertFalse(verify(tree(case("Other/testCase()"))))
        for malformed in (tree(), tree(case(), case()), tree({})):
            with self.assertRaises(ValueError):
                verify(malformed)

    def test_editor_writes_private_plist_and_never_echoes_input(self):
        original = self.base / "generated.xctestrun"
        original.write_bytes(plistlib.dumps(v2(target())))
        destination = self.base / "fixture-private.xctestrun"
        command = [sys.executable, str(ROOT / "evidence.py"), "prepare",
                   str(original), str(destination), str(self.app)]
        result = subprocess.run(command, input=DUMMY, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout + result.stderr, "")
        self.assertEqual(destination.stat().st_mode & 0o777, 0o600)
        self.assertNotIn(DUMMY.encode(), original.read_bytes())
        repeated = subprocess.run(command, input=DUMMY, text=True, capture_output=True)
        self.assertNotEqual(repeated.returncode, 0)
        self.assertNotIn(DUMMY, repeated.stdout + repeated.stderr)

    def test_real_ui_required_and_only_safe_summary_uploaded(self):
        spec = ROOT / "SortexFixtureUI.xcodeproj"
        scheme = spec / "xcshareddata/xcschemes/SortexFixtureUITests.xcscheme"
        xml = ElementTree.parse(scheme)
        references = xml.findall(".//BuildableReference")
        self.assertEqual(len(references), 2)
        pbx = (spec / "project.pbxproj").read_text()
        for ref in references:
            self.assertEqual(ref.get("BlueprintName"), TARGET)
            self.assertIn(ref.get("BlueprintIdentifier"), pbx)
        self.assertIn("com.apple.product-type.bundle.ui-testing", pbx)
        swift = (ROOT / "BuyerJourneys.swift").read_text()
        for stage in ("startup", "email", "password", "login", "campaign",
                      "signed-in-relaunch", "logout", "signed-out-relaunch"):
            self.assertIn('"sortex-' + stage + '"', swift)
        self.assertIn('secureTextFields["sortex-login-password"]', swift)
        self.assertIn("pass.typeText(password)", swift)
        self.assertNotIn("pass.value", swift)
        self.assertNotIn("launchEnvironment", swift)
        workflow = (ROOT.parent / "workflows/mobile-native-xcuitest.yml").read_text()
        self.assertEqual(workflow.count("actions/upload-artifact"), 1)
        self.assertIn("/sortex-xcuitest-summary.txt", workflow)
        self.assertNotIn(".xcresult", workflow)
        shell = (ROOT / "run.sh").read_text()
        self.assertIn("test-without-building >\"$temp/test.log\" 2>&1", shell)
        self.assertIn("rm -rf -- \"$temp\"", shell)
        finish = (ROOT / "finish.sh").read_text()
        self.assertIn("server-verification-complete", finish)
        self.assertLess(finish.index("with-fixture.sh"), finish.index("server-verification-complete"))

    def test_launcher_fails_closed_before_tools_on_unapproved_context(self):
        command = ["bash", str(ROOT / "run.sh")]
        canned = {"PATH": os.environ["PATH"], "RUNNER_OS": "macOS",
                  "GITHUB_REPOSITORY": "blackwolfoficiall-glitch/SorteX",
                  "GITHUB_REF": "refs/heads/homologacao/web-ios-integrada", "GITHUB_EVENT_NAME": "push"}
        for override, category in (
            ({"GITHUB_REF": "refs/heads/main"}, "execution-context"),
            ({"EXPO_PUBLIC_API_URL": "https://qa.example.test"}, "fixture-scope"),
            ({"SORTEX_IOS_UI_SCOPE": "disposable-loopback", "SORTEX_IOS_UI_API": "http://127.0.0.1:3338",
              "EXPO_PUBLIC_API_URL": "http://127.0.0.1:3338", "EXPO_PUBLIC_ALLOW_LOCAL_API": "1",
              "EXPO_PUBLIC_ENABLE_TEST_RESERVATIONS": "0", "DATABASE_URL": DUMMY}, "fixture-scope"),
        ):
            result = subprocess.run(command, env=canned | override, text=True, capture_output=True)
            self.assertEqual(result.returncode, 64)
            self.assertIn(category, result.stderr)
            self.assertNotIn(DUMMY, result.stdout + result.stderr)
        self.assertFalse(list(self.base.glob("sortex-xcuitest.*")))


if __name__ == "__main__":
    unittest.main()
