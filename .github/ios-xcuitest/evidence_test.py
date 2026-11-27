"""Linux-portable tests for the XCUITest test host's redaction contract."""

import json
import os
import re
from pathlib import Path
import plistlib
import subprocess
import sys
import tempfile
import unittest
from xml.etree import ElementTree

sys.dont_write_bytecode = True
from evidence import APP_SUFFIX, PASSWORD_KEY, TARGET, TEST, configure, describe_shape, verify

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
            self.assertEqual(t["UITargetAppEnvironmentVariables"], {})
            self.assertNotIn("UITargetAppCommandLineArguments", t)
            self.assertEqual(t["UITargetAppPath"], str(self.app))
            self.assertEqual(t["SystemAttachmentLifetime"], "keepNever")
            self.assertEqual(t["UserAttachmentLifetime"], "keepNever")
            self.assertEqual(t["OnlyTestIdentifiers"], [TEST.removesuffix("()")])
            self.assertFalse(t["ParallelizationEnabled"])

    def test_rejects_altered_test_specification_or_fixture(self):
        for wrong in (
            {"UITargetAppEnvironmentVariables": {"OTHER": [DUMMY]}},
            {"UITargetAppEnvironmentVariables": {"OTHER": 7}},
            {"UITargetAppEnvironmentVariables": {7: DUMMY}},
            {"UITargetAppEnvironmentVariables": []},
            {"UITargetAppEnvironmentVariables": None},
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

    def test_shape_diagnostics_are_fixed_and_separate(self):
        for override, expected, fact, value in (
            ({"TestBundlePath": "/" + DUMMY + ".xctest"}, "bundle-path", "test-bundle", "other-product"),
            ({"TestBundlePath": TARGET + ".xctest"}, "bundle-path", "test-bundle", "expected-basename"),
            ({"TestHostPath": "/" + DUMMY + ".app"}, "host-path", "test-host", "other-product"),
            ({"UITargetAppEnvironmentVariables": {DUMMY: DUMMY}}, "passed", "app-environment", "sanitizable"),
            ({"UITargetAppEnvironmentVariables": {DUMMY: [DUMMY]}}, "app-environment", "app-environment", "malformed"),
            ({"UITargetAppEnvironmentVariables": {DUMMY: DUMMY}, "UITargetAppCommandLineArguments": [DUMMY]},
             "app-arguments", "app-environment", "sanitizable"),
            ({"UITargetAppCommandLineArguments": [DUMMY]}, "app-arguments", "app-arguments", "present"),
            ({"EnvironmentVariables": {PASSWORD_KEY: DUMMY}}, "host-environment", "host-environment", "present"),
        ):
            with self.subTest(expected=expected):
                shape = describe_shape(v2(target() | override))
                self.assertEqual(shape["readiness"], expected)
                self.assertEqual(shape[fact], value)
                self.assertNotIn(DUMMY, str(shape))
        dual = describe_shape(v2(target() | {"TestBundlePath": "other.xctest", "TestHostPath": "other.app"}))
        self.assertEqual(dual["test-bundle"], "other-product")
        self.assertEqual(dual["test-host"], "other-product")
        self.assertEqual(describe_shape(v2(target(), target()))["targets"], "multiple")
        self.assertEqual(describe_shape(v2())["targets"], "zero")
        configs = describe_shape({"__xctestrun_metadata__": {"FormatVersion": 2}, "TestConfigurations": [{}, {}]})
        self.assertEqual(configs["configurations"], "multiple")
        self.assertEqual(configs["readiness"], "configuration-count")
        self.assertEqual(describe_shape({"__xctestrun_metadata__": {"FormatVersion": 3}})["format"], "unsupported")
        self.assertEqual(describe_shape({TARGET: target()})["format"], "v1")

    def test_xcode_v1_app_env_is_discarded_before_writing_private_spec(self):
        env_key = "SYNTHETIC_XCODE_DEFAULT_KEY"
        env_value = "SYNTHETIC_XCODE_DEFAULT_VALUE"
        original = self.base / "generated.xctestrun"
        destination = self.base / "fixture-private.xctestrun"
        raw = plistlib.dumps({
            TARGET: target() | {
                "UITargetAppPath": "",
                "UITargetAppEnvironmentVariables": {
                    env_key: env_value, PASSWORD_KEY: "DO_NOT_FORWARD_APP_VALUE"
                },
                "UITargetAppCommandLineArguments": [],
                "EnvironmentVariables": {"HOST_SETTING": "KEEP"},
                "TestingEnvironmentVariables": {"DYLD_FRAMEWORK_PATH": "__TESTROOT__"},
            },
        }, fmt=plistlib.FMT_BINARY)
        original.write_bytes(raw)
        inspect = subprocess.run([sys.executable, str(ROOT / "evidence.py"), "inspect", str(original)],
                                 text=True, capture_output=True)
        self.assertEqual(inspect.returncode, 0)
        self.assertIn("format=v1", inspect.stdout)
        self.assertIn("app-environment=sanitizable", inspect.stdout)
        self.assertIn("readiness=passed", inspect.stdout)
        self.assertNotIn(env_key, inspect.stdout + inspect.stderr)
        self.assertNotIn(env_value, inspect.stdout + inspect.stderr)
        self.assertFalse(destination.exists())
        prepare = subprocess.run([sys.executable, str(ROOT / "evidence.py"), "prepare",
                                  str(original), str(destination), str(self.app)],
                                 input=DUMMY, text=True, capture_output=True)
        self.assertEqual(prepare.returncode, 0)
        self.assertEqual(prepare.stdout + prepare.stderr, "")
        private = destination.read_bytes()
        spec = plistlib.loads(private)[TARGET]
        for dropped in (env_key, env_value, "DO_NOT_FORWARD_APP_VALUE"):
            self.assertNotIn(dropped.encode(), private)
            self.assertNotIn(dropped, inspect.stdout + inspect.stderr)
        self.assertEqual(original.read_bytes(), raw)
        self.assertEqual(spec["UITargetAppEnvironmentVariables"], {})
        self.assertEqual(spec["EnvironmentVariables"], {"HOST_SETTING": "KEEP", PASSWORD_KEY: DUMMY})
        self.assertEqual(spec["TestingEnvironmentVariables"], {"DYLD_FRAMEWORK_PATH": "__TESTROOT__"})

    def test_inspect_never_writes_spec_or_echoes_paths(self):
        original = self.base / "generated.xctestrun"
        raw = plistlib.dumps(v2(target() | {"UITargetAppPath": "/" + DUMMY}))
        original.write_bytes(raw)
        result = subprocess.run([sys.executable, str(ROOT / "evidence.py"), "inspect", str(original)],
                                input=DUMMY, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn("app-target=present", result.stdout)
        self.assertIn("readiness=passed", result.stdout)
        self.assertNotIn(DUMMY, result.stdout + result.stderr)
        self.assertEqual(original.read_bytes(), raw)
        self.assertFalse(list(self.base.glob("fixture-private.xctestrun")))

    def test_driver_only_preflight_with_fake_local_xcrun(self):
        binpath = self.base / "bin"
        binpath.mkdir()
        fake = binpath / "xcrun"
        fake.write_text('''#!/usr/bin/env bash
set -euo pipefail
case "${1:-}:${2:-}" in
  xcodebuild:-version)
    printf 'Xcode 27.2\nBuild version 27Z123\nunsafe extra line\n'
    ;;
  xcodebuild:-project)
    while [[ "$#" -gt 0 && "$1" != -derivedDataPath ]]; do shift; done
    [[ "${@: -1}" == build-for-testing ]]
    [[ "$2" == "$RUNNER_TEMP/sortex-xcuitest-preflight."*/driver ]]
    mkdir -p "$2/Build/Products"
    cp "$PREFLIGHT_SAMPLE" "$2/Build/Products/fixture.xctestrun"
    ;;
  *) exit 99 ;;
esac
''')
        fake.chmod(0o700)
        fixture = self.base / "sample.xctestrun"
        raw = plistlib.dumps({TARGET: target() | {
            "UITargetAppPath": "", "UITargetAppEnvironmentVariables": {DUMMY: DUMMY}
        }})
        fixture.write_bytes(raw)
        env = {"PATH": str(binpath) + os.pathsep + os.environ["PATH"], "RUNNER_OS": "macOS",
               "GITHUB_REPOSITORY": "blackwolfoficiall-glitch/SorteX",
               "GITHUB_REF": "refs/heads/homologacao/web-ios-integrada", "GITHUB_EVENT_NAME": "push",
               "GITHUB_SHA": "f" * 40, "RUNNER_TEMP": str(self.base), "PREFLIGHT_SAMPLE": str(fixture),
               "SORTEX_SIMULATOR_ID": "00000000-0000-0000-0000-000000000001"}
        command = ["bash", str(ROOT / "preflight.sh")]
        denied = subprocess.run(command, env=env | {"SORTEX_IOS_UI_BUYER_PASSWORD": DUMMY},
                                text=True, capture_output=True)
        self.assertEqual(denied.returncode, 64)
        self.assertFalse((self.base / "sortex-xcuitest-driver-preflight.txt").exists())
        result = subprocess.run(command, env=env, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = (self.base / "sortex-xcuitest-driver-preflight.txt").read_text()
        self.assertIn("readiness=passed", report)
        self.assertIn("Xcode 27.2", report)
        self.assertIn("app-environment=sanitizable", report)
        self.assertNotIn("unsafe extra line", report)
        self.assertNotIn(DUMMY, report)
        self.assertEqual(fixture.read_bytes(), raw)
        self.assertFalse(list(self.base.glob("sortex-xcuitest-preflight.*")))

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

    def test_full_driver_uses_exact_control_email_chunks(self):
        swift = (ROOT / "BuyerJourneys.swift").read_text()
        control = (ROOT.parent / "ios-xcuitest-input-controls/BuyerEmailInputControls.swift").read_text()
        chunks = re.search(r"let buyerChunks = (\[[^\n]+\])", swift)
        self.assertIsNotNone(chunks)
        self.assertIn("for chunk in " + chunks[1], control)
        synthetic_email = re.search(r'private let buyer = "([^"]+)"', swift)
        self.assertIsNotNone(synthetic_email)
        self.assertIn('private let expected = "' + synthetic_email[1] + '"', control)
        self.assertEqual("".join(json.loads(chunks[1])), synthetic_email[1])
        self.assertIn("guard buyerChunks.joined() == buyer", swift)

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
        for stage in ("startup", "email-tap", "email-keyboard", "email-type", "email-prefix-mismatch",
                      "email-readback",
                      "email-readback-unavailable", "email-readback-label", "email-readback-normalization",
                      "email-readback-leading-dropped", "email-readback-trailing-dropped",
                      "email-readback-edge-truncated", "email-readback-extra-text", "email-readback-mismatch",
                      "password", "login", "campaign-home-ready",
                      "campaign-tab-discover", "campaign-tab-actionable", "campaign-tab-initial-selection", "campaign-tab-tap",
                      "campaign-tab-selected", "campaign-screen-visible", "campaign-list", "campaign-open", "campaign-detail", "campaign-prize", "campaign-regulation",
                      "signed-in-relaunch", "logout", "signed-out-relaunch"):
            self.assertIn('"sortex-' + stage + '"', swift)
        email_activity = swift.split('sortex-email-tap', 1)[1].split('sortex-password', 1)[0]
        self.assertEqual(email_activity.count('email.tap()'), 1)
        self.assertEqual(email_activity.count('email.typeText('), 1)
        self.assertIn('for chunk in buyerChunks', email_activity)
        self.assertIn('email.typeText(chunk)', email_activity)
        self.assertIn('expectedPrefix += chunk', email_activity)
        self.assertIn('guard waitUntil(timeout: 2, { email.value as? String == expectedPrefix })', email_activity)
        self.assertIn('XCTFail("Exact fixture email prefix did not match")', email_activity)
        self.assertNotIn('\\(', email_activity)
        self.assertIn('app.keyboards.firstMatch.waitForExistence(timeout: 8)', email_activity)
        self.assertIn('let matched = waitUntil(timeout: 2)', email_activity)
        self.assertIn('return entered == buyer', email_activity)
        self.assertIn('guard matched else', email_activity)
        self.assertIn('let reason = emailReadbackFailure(entered, expected: buyer)', email_activity)
        self.assertIn('XCTContext.runActivity(named: reason.rawValue)', email_activity)
        self.assertNotIn('lowercased', email_activity)
        self.assertNotIn('trimmingCharacters', email_activity)
        self.assertNotIn('emailReadbackFailure(entered, expected: buyer).', email_activity)
        self.assertNotIn("print(", email_activity)
        self.assertNotIn("entered.count", email_activity)
        self.assertNotIn("debugDescription", email_activity)
        self.assertIn('secureTextFields["sortex-login-password"]', swift)
        self.assertIn("pass.typeText(password)", swift)
        self.assertNotIn("pass.value", swift)
        self.assertNotIn("launchEnvironment", swift)
        app = (ROOT.parent.parent / "apps/mobile/App.tsx").read_text()
        self.assertIn('tabBarButtonTestID: "sortex-buyer-campaigns-tab"', app)
        self.assertIn('titleTestID={!organizer && focused ? "sortex-buyer-campaigns-screen"', app)
        self.assertIn('detailsTestID={!organizer ? `sortex-buyer-campaign-open-${item.slug}` : undefined}', app)
        self.assertIn('identified("sortex-buyer-campaigns-tab", in: app)', swift)
        self.assertIn('identified("sortex-buyer-campaign-open-campanha-sintetica-ios", in: app)', swift)
        self.assertIn('descendants(matching: .any).matching(NSPredicate(format: "identifier == %@", identifier))', swift)
        self.assertIn('guard waitUntil(timeout: 10, { campaignTab.isEnabled && campaignTab.isHittable })', swift)
        self.assertEqual(swift.count('campaignTab.tap()'), 1)
        self.assertLess(swift.index('sortex-campaign-tab-actionable'), swift.index('sortex-campaign-tab-initial-selection'))
        self.assertLess(swift.index('sortex-campaign-tab-initial-selection'), swift.index('sortex-campaign-tab-tap'))
        self.assertIn('campaignTabQuery.count, 1', swift)
        self.assertIn('XCTAssertFalse(campaignTab.isSelected', swift)
        self.assertIn('waitUntil(timeout: 10) { campaignTab.isSelected }', swift)
        self.assertLess(swift.index('sortex-campaign-tab-tap'), swift.index('sortex-campaign-tab-selected'))
        self.assertLess(swift.index('sortex-campaign-tab-selected'), swift.index('sortex-campaign-screen-visible'))
        self.assertLess(swift.index('sortex-campaign-screen-visible'), swift.index('sortex-campaign-list'))
        self.assertIn('identified("sortex-buyer-campaigns-screen", in: app)', swift)
        component = (ROOT.parent.parent / "apps/mobile/src/buyer/NativeBuyerCampaignTabButton.tsx").read_text()
        buyer_options = app.split('function MainTabs()', 1)[1].split('export default function App()', 1)[0]
        self.assertIn('...(Platform.OS === "ios" ?', buyer_options)
        self.assertIn('tabBarButton: (props) => <NativeBuyerCampaignTabButton {...props} />', buyer_options)
        self.assertIn('accessibilityRole="button"', component)
        self.assertIn('accessibilityState={{ selected, disabled }}', component)
        self.assertIn('onPress={onPress}', component)
        self.assertIn('onLongPress={onLongPress}', component)
        self.assertNotIn('navigate(', component)
        self.assertIn('fixtureCampaignQuery.count, 1', swift)
        campaign_stage = swift.split('let campaignTabQuery', 1)[1].split('sortex-signed-in-relaunch', 1)[0]
        self.assertEqual(campaign_stage.count('campaignTab.tap()'), 1)
        self.assertNotIn('coordinate', campaign_stage.split('campaign-tab-tap', 1)[1])
        self.assertNotIn('app.buttons["Ver campanha"]', swift)
        self.assertIn('app.staticTexts["Regulamento sintetico da campanha iOS."]', swift)
        workflow = (ROOT.parent / "workflows/mobile-native-xcuitest.yml").read_text()
        preflight, full = workflow.split("  buyer-session:", 1)
        self.assertEqual(preflight.count("actions/upload-artifact"), 1)
        self.assertEqual(full.count("actions/upload-artifact"), 2)
        self.assertIn("/sortex-xcuitest-summary.txt", full)
        self.assertIn("/sortex-xcuitest-failure.txt", full)
        self.assertIn("steps.xctest-run.outcome == 'failure'", full)
        self.assertIn('python3 "$base/failure.py" "$result" "$temp/test.log" >/dev/null 2>&1 || true',
                      (ROOT / "run.sh").read_text())
        self.assertIn("run_full=false", preflight)
        self.assertIn("needs: driver-preflight", full)
        self.assertIn("needs.driver-preflight.outputs.run_full == 'true'", full)
        for action in ("npm ci", "brew install", "simctl bootstatus", "with-fixture.sh", "finish.sh"):
            self.assertNotIn(action, preflight)
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
