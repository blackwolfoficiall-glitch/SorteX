"""Verify that a pre-XCTest failure produces no raw fixture evidence."""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent
PRIVATE = 'SYNTHETIC_PRIVATE_SENTINEL'
SHA = 'f' * 40


class FixtureFailureTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.base = Path(tmp.name)
        self.checkpoint = self.base / "sortex-native-ui-checkpoint"
        self.report = self.base / "sortex-xcuitest-fixture-failure.txt"
        self.env = {"PATH": os.environ["PATH"], "RUNNER_TEMP": str(self.base), "GITHUB_SHA": SHA}

    def report_failure(self, env=None):
        return subprocess.run(["bash", str(ROOT / "fixture-failure.sh")],
                              env=self.env if env is None else env, capture_output=True, text=True)

    def assert_report(self, checkpoint, window):
        self.assertEqual(self.report.read_text(),
                         f"sha={SHA}\nlast-checkpoint={checkpoint}\nnext-unrecorded-window={window}\n")
        self.assertEqual(self.report.stat().st_mode & 0o777, 0o600)
        self.report.unlink()

    def test_redacted_stage_from_migration_to_ui_and_postcheck(self):
        for last, next_ in (("migrations-applied", "fixture-seed"),
                            ("fixture-seeded", "api-readiness"),
                            ("api-ready", "launcher-entry"),
                            ("release-installed", "driver-or-ui"),
                            ("signed-out-relaunch-verified", "server-verification")):
            self.checkpoint.write_text(last + "\n" + PRIVATE + "\n")
            result = self.report_failure()
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stdout + result.stderr, "")
            self.assert_report(last, next_)

    def test_reports_only_fixed_values_for_missing_unknown_or_symlink_checkpoint(self):
        self.assertEqual(self.report_failure().returncode, 0)
        self.assert_report("none", "fixture-entry")
        self.checkpoint.write_text(PRIVATE + "\n")
        self.assertEqual(self.report_failure().returncode, 0)
        self.assert_report("unknown", "unknown")
        self.checkpoint.unlink()
        outside = self.base / "unapproved.log"
        outside.write_text("migrations-applied\n" + PRIVATE + "\n")
        self.checkpoint.symlink_to(outside)
        self.assertEqual(self.report_failure().returncode, 0)
        self.assert_report("none", "fixture-entry")

    def test_bad_sha_or_existing_report_does_not_overwrite(self):
        self.assertNotEqual(self.report_failure(self.env | {"GITHUB_SHA": PRIVATE}).returncode, 0)
        self.assertFalse(self.report.exists())
        self.report.write_text(PRIVATE)
        self.assertNotEqual(self.report_failure().returncode, 0)
        self.assertEqual(self.report.read_text(), PRIVATE)

    def test_finish_records_early_failed_fixture_and_preserves_exit_status(self):
        checkout = self.base / "fake-checkout"
        xcui = checkout / ".github/ios-xcuitest"
        native = checkout / ".github/native-ui"
        xcui.mkdir(parents=True)
        native.mkdir(parents=True)
        for name in ("finish.sh", "fixture-failure.sh"):
            shutil.copyfile(ROOT / name, xcui / name)
        (native / "with-fixture.sh").write_text(
            'printf "migrations-applied\\n" > "$RUNNER_TEMP/sortex-native-ui-checkpoint"\n'
            'exit 27\n'
        )
        result = subprocess.run(["bash", str(xcui / "finish.sh")], env=self.env,
                                text=True, capture_output=True)
        self.assertEqual(result.returncode, 27)
        self.assertEqual(result.stdout + result.stderr, "")
        self.assert_report("migrations-applied", "fixture-seed")
        self.assertFalse((self.base / "sortex-xcuitest-summary.txt").exists())

    def test_finish_keeps_failure_and_success_gates_separate(self):
        finish = (ROOT / "finish.sh").read_text()
        self.assertIn('if bash "$root/.github/native-ui/with-fixture.sh" bash "$base/run.sh"; then', finish)
        self.assertIn('bash "$base/fixture-failure.sh" >/dev/null 2>&1 || true\n  exit "$result"', finish)
        self.assertIn('[[ "$stage" == server-verification-complete ]]', finish)
        workflow = (ROOT.parent / "workflows/mobile-native-xcuitest.yml").read_text()
        self.assertIn("steps.xctest-run.outcome == 'failure'", workflow)
        self.assertIn("/sortex-xcuitest-fixture-failure.txt", workflow)
        self.assertNotIn(".xcresult", workflow)


if __name__ == "__main__":
    unittest.main()
