"""Prepare a private test specification and accept exactly one known UI pass."""

import json
import os
from pathlib import Path
import plistlib
import re
import sys

TARGET = "SortexFixtureUITests"
APP_SUFFIX = "/sortex-ios-simulator/Build/Products/Release-iphonesimulator/SorteXTeste.app"
TEST = "BuyerJourneys/testBuyerSessionAndCampaign()"
PASSWORD_KEY = "SORTEX_XCUI_FIXTURE_PASSWORD"


ALLOWED_REJECTIONS = {
    "malformed-plist", "unsupported-format", "configuration-count", "test-disabled",
    "target-count", "blueprint", "bundle-path", "host-path", "skip-tests",
    "destination-artifacts", "app-environment", "app-arguments", "host-environment",
}


def selected_target(spec):
    if not isinstance(spec, dict):
        raise ValueError("malformed-plist")
    version = spec.get("__xctestrun_metadata__", {}).get("FormatVersion", 1)
    if version == 1:
        targets = [value for key, value in spec.items() if key != "__xctestrun_metadata__"]
    elif version == 2:
        configs = spec["TestConfigurations"]
        if not isinstance(configs, list) or len(configs) != 1:
            raise ValueError("configuration-count")
        if not configs[0].get("IsEnabled", True):
            raise ValueError("test-disabled")
        targets = configs[0]["TestTargets"]
    else:
        raise ValueError("unsupported-format")
    if not isinstance(targets, list) or len(targets) != 1:
        raise ValueError("target-count")
    if not isinstance(targets[0], dict):
        raise ValueError("malformed-plist")
    return targets[0]


def valid_string_map(value):
    return isinstance(value, dict) and all(
        isinstance(key, str) and isinstance(item, str) for key, item in value.items()
    )


def validate_target(target):
    checks = [
        (target.get("BlueprintName", TARGET) == TARGET, "blueprint"),
        (known_path(target.get("TestBundlePath"), TARGET + ".xctest", ".xctest") == "expected-path", "bundle-path"),
        (known_path(target.get("TestHostPath"), TARGET + "-Runner.app", ".app") == "expected-path", "host-path"),
        (not target.get("SkipTestIdentifiers", []), "skip-tests"),
        (not target.get("UseDestinationArtifacts", False), "destination-artifacts"),
        (valid_string_map(target.get("UITargetAppEnvironmentVariables", {})), "app-environment"),
        (not target.get("UITargetAppCommandLineArguments", []), "app-arguments"),
    ]
    env = target.get("EnvironmentVariables", {})
    testing_env = target.get("TestingEnvironmentVariables", {})
    checks.append((isinstance(env, dict) and isinstance(testing_env, dict)
                  and PASSWORD_KEY not in env and PASSWORD_KEY not in testing_env,
                  "host-environment"))
    for allowed, reason in checks:
        if not allowed:
            raise ValueError(reason)


def known_path(value, basename, other_suffix):
    if value is None:
        return "missing"
    if not isinstance(value, str):
        return "invalid-type"
    if value.endswith("/" + basename):
        return "expected-path"
    if value == basename:
        return "expected-basename"
    if value.endswith(other_suffix):
        return "other-product"
    return "other"


def cardinality(items):
    if not isinstance(items, list):
        return "invalid-type"
    return {0: "zero", 1: "one"}.get(len(items), "multiple")


def describe_shape(spec):
    """Expose only fixed labels. Never emit plist contents, names or paths."""
    facts = {"format": "unknown", "configurations": "unknown", "targets": "unknown",
             "blueprint": "unknown", "test-bundle": "unknown", "test-host": "unknown",
             "app-target": "unknown", "app-environment": "unknown", "app-arguments": "unknown",
             "host-environment": "unknown", "host-testing-environment": "unknown",
             "readiness": "malformed-plist"}
    try:
        version = spec.get("__xctestrun_metadata__", {}).get("FormatVersion", 1)
        facts["format"] = {1: "v1", 2: "v2"}.get(version, "unsupported")
        if version == 1:
            facts["configurations"] = "not-applicable"
            facts["targets"] = cardinality([v for k, v in spec.items() if k != "__xctestrun_metadata__"])
        elif version == 2:
            configs = spec.get("TestConfigurations")
            facts["configurations"] = cardinality(configs)
            if isinstance(configs, list) and len(configs) == 1 and isinstance(configs[0], dict):
                facts["targets"] = cardinality(configs[0].get("TestTargets"))
        target = selected_target(spec)
        name = target.get("BlueprintName")
        facts["blueprint"] = "missing" if name is None else ("expected" if name == TARGET else "other")
        facts["test-bundle"] = known_path(target.get("TestBundlePath"), TARGET + ".xctest", ".xctest")
        facts["test-host"] = known_path(target.get("TestHostPath"), TARGET + "-Runner.app", ".app")
        for label, key in (
            ("app-target", "UITargetAppPath"),
            ("app-arguments", "UITargetAppCommandLineArguments"),
            ("host-environment", "EnvironmentVariables"),
            ("host-testing-environment", "TestingEnvironmentVariables"),
        ):
            facts[label] = "present" if target.get(key) else "empty-or-missing"
        app_env = target.get("UITargetAppEnvironmentVariables", {})
        facts["app-environment"] = (
            ("sanitizable" if app_env else "empty-or-missing")
            if valid_string_map(app_env) else "malformed"
        )
        validate_target(target)
        facts["readiness"] = "passed"
    except ValueError as error:
        code = str(error)
        if code in ALLOWED_REJECTIONS:
            facts["readiness"] = code
    except (TypeError, KeyError, AttributeError, IndexError):
        pass
    return facts


def configure(spec, app, password):
    if not re.fullmatch(r"[0-9a-f]{48}", password):
        raise ValueError("fixture-input")
    if not app.is_absolute() or not str(app).endswith(APP_SUFFIX) or not app.is_dir():
        raise ValueError("app-target")
    target = selected_target(spec)
    validate_target(target)
    # The standalone Xcode target may supply a default app environment. Do not
    # merge or forward any entries, even if a name looks safe. The app remains
    # a black-box test subject and receives the password only by UI input.
    target["UITargetAppEnvironmentVariables"] = {}
    env = target.setdefault("EnvironmentVariables", {})
    env[PASSWORD_KEY] = password
    # The stand-alone test target doesn't build the app. This is the exact,
    # already-built and verified Release app; Xcode may re-install that bundle.
    target["UITargetAppPath"] = str(app)
    target["UITargetAppBundleIdentifier"] = "br.com.sortex.development"
    target["DependentProductPaths"] = list(dict.fromkeys(
        [*target.get("DependentProductPaths", []), str(app)]
    ))
    target["OnlyTestIdentifiers"] = [TEST.removesuffix("()")]
    target["SystemAttachmentLifetime"] = "keepNever"
    target["UserAttachmentLifetime"] = "keepNever"
    target["ParallelizationEnabled"] = False
    return spec


def verify(tree):
    def cases(nodes):
        for node in nodes:
            if node.get("nodeType") == "Test Case":
                yield node["nodeIdentifier"], node["result"]
            else:
                yield from cases(node.get("children", []))
    (identifier, result), = cases(tree["testNodes"])
    return identifier.removesuffix("()") == TEST.removesuffix("()") and result == "Passed"


def main():
    os.umask(0o077)
    action, *args = sys.argv[1:]
    if action == "prepare":
        source, destination, app = map(Path, args)
        if source.parent.resolve() != destination.parent.resolve() or source.suffix != ".xctestrun" or destination.suffix != ".xctestrun":
            raise ValueError("unexpected-plist-path")
        with source.open("rb") as reader:
            spec = configure(plistlib.load(reader), app, sys.stdin.read(49))
        with destination.open("xb") as writer:
            plistlib.dump(spec, writer)
    elif action == "inspect":
        source, = map(Path, args)
        try:
            with source.open("rb") as reader:
                facts = describe_shape(plistlib.load(reader))
        except (TypeError, ValueError, AttributeError, OSError, plistlib.InvalidFileException):
            facts = describe_shape(None)
        for label, value in facts.items():
            print(f"{label}={value}")
        if facts["readiness"] != "passed":
            sys.exit(64)
    elif action == "verify":
        if args or not verify(json.load(sys.stdin)):
            raise ValueError("native-test-did-not-pass")
    else:
        raise ValueError("unknown-command")


if __name__ == "__main__":
    try:
        main()
    except (TypeError, ValueError, KeyError, IndexError, AttributeError, OverflowError, OSError, plistlib.InvalidFileException):
        # Malformed reports can contain user values. Do not print exceptions.
        sys.exit("XCUITest evidence rejected.")
