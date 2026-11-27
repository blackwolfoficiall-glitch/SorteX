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


def configure(spec, app, password):
    if not re.fullmatch(r"[0-9a-f]{48}", password):
        raise ValueError("fixture-input")
    if not app.is_absolute() or not str(app).endswith(APP_SUFFIX) or not app.is_dir():
        raise ValueError("app-target")

    metadata = spec.get("__xctestrun_metadata__", {})
    version = metadata.get("FormatVersion", 1)
    if version == 1:
        targets = [value for key, value in spec.items() if key != "__xctestrun_metadata__"]
    elif version == 2:
        config, = spec["TestConfigurations"]
        if not config.get("IsEnabled", True):
            raise ValueError("test-disabled")
        targets = config["TestTargets"]
    else:
        raise ValueError("unsupported-format")
    target, = targets
    if (
        target.get("BlueprintName", TARGET) != TARGET
        or not target["TestBundlePath"].endswith("/" + TARGET + ".xctest")
        or not target["TestHostPath"].endswith("/" + TARGET + "-Runner.app")
        or set(target.get("SkipTestIdentifiers", []))
        or target.get("UseDestinationArtifacts", False)
        or target.get("UITargetAppEnvironmentVariables", {})
        or target.get("UITargetAppCommandLineArguments", [])
    ):
        raise ValueError("unexpected-test-target")
    # Never set the password under UITargetAppEnvironmentVariables: the Release
    # app is an ordinary black-box test subject and learns it only via key input.
    env = target.setdefault("EnvironmentVariables", {})
    if PASSWORD_KEY in env or PASSWORD_KEY in target.get("TestingEnvironmentVariables", {}):
        raise ValueError("unexpected-test-environment")
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
