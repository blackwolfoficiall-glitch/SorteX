from pathlib import Path
import re
import subprocess

import yaml

here = Path(__file__).resolve().parent
repo = here.parents[2]
workflow = yaml.load((here / "release-draw-window-qa.yml").read_text(), Loader=yaml.BaseLoader)
assert set(workflow["on"]) == {"workflow_dispatch"}
inputs = workflow["on"]["workflow_dispatch"]["inputs"]
assert set(inputs) == {"mode", "plan_run_id", "quiet_window", "confirmation"}
assert inputs["mode"]["options"] == ["plan", "apply"]
assert inputs["mode"]["default"] == "plan"
assert inputs["quiet_window"]["default"] == "false"
assert workflow["permissions"] == {"contents": "read"}
assert workflow["concurrency"] == {
    "group": "sortex-web-ios-qa-bootstrap", "cancel-in-progress": "false",
}
auth, execute = (workflow["jobs"][name] for name in ("authorize", "execute"))
assert "environment" not in auth
assert auth["permissions"] == {"contents": "read", "actions": "read"}
assert execute["permissions"] == {"contents": "read", "actions": "read"}
assert execute["environment"] == "sortex-web-ios-qa"
assert execute["needs"] == "authorize"
assert execute["name"] == "${{ inputs.mode == 'plan' && 'QA read-only plan' || 'QA apply' }}"
for job in (auth, execute):
    for expression in (
        "github.repository == 'blackwolfoficiall-glitch/SorteX'",
        "github.ref == 'refs/heads/homologacao/web-ios-integrada'",
        "github.event_name == 'workflow_dispatch'",
        "github.run_attempt == '1'",
    ):
        assert expression in job["if"]
    for step in job["steps"]:
        if step.get("uses"):
            assert re.fullmatch(r"actions/(checkout|setup-node)@[a-f0-9]{40}", step["uses"])
            if step["uses"].startswith("actions/checkout@"):
                assert step["with"]["persist-credentials"] == "false"
        if command := step.get("run"):
            subprocess.run(["bash", "-n"], input=command, text=True, check=True)
            assert "secrets." not in command
            assert "set -x" not in command
            assert "${{" not in command  # Inputs cross the shell boundary as env only.
    assert all("secrets." not in str(step) for step in job["steps"][:-1])

assert auth["steps"][-1]["if"] == "inputs.mode == 'apply'"
assert auth["steps"][-1]["env"]["QA_ACTIONS_READ_TOKEN"] == "${{ github.token }}"
steps = execute["steps"]
assert steps[0]["with"]["fetch-depth"] == "0"
assert steps[1]["with"]["ref"] == "d4e499e29c76a11f4275c2be8d34e6a4a616cb70"
build, recheck, release = steps[-3:]
assert recheck["if"] == "inputs.mode == 'apply'"
assert recheck["env"]["QA_ACTIONS_READ_TOKEN"] == "${{ github.token }}"
assert recheck["run"].endswith(" --plan-receipt")
assert "env" not in build
assert "env -i" in build["run"] and "127.0.0.1:5432/sortex_build" in build["run"]
assert "npm run build:neon" in build["run"]
assert {k for k, v in release["env"].items() if "secrets." in v} == {
    "SORTEX_QA_DATABASE_URL", "SORTEX_QA_NEON_API_KEY",
}
assert 'node services/api/scripts/release-draw-window-qa.cjs "--$QA_MODE"' in release["run"]
assert (repo / ".github/workflows/redeploy-isolated-web-ios.yml").read_bytes() == (here / "release-draw-window-qa.yml").read_bytes()
print("Executor manual: YAML, gatilhos, escopo, pinagem, credenciais e comandos verificados.")
