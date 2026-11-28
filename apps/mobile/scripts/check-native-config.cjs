// Email-only development build: do not request unconfigured, account-bound capabilities.
const fs = require("node:fs");
const path = require("node:path");
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(dir, entry.name))
        : [path.join(dir, entry.name)],
    );
}
const files = walk("ios").filter(
  (file) => file.endsWith(".entitlements") && !file.includes("/Pods/"),
);
if (!files.length)
  throw new Error("Generated iOS entitlements missing. Run prebuild first.");
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  if (/com\.apple\.developer\.(applesignin|associated-domains)/.test(content))
    throw new Error(
      "Unconfigured social capability in email-only build. Configure and validate the provider before enabling it.",
    );
}
console.log(
  "PASS: no unconfigured social capabilities in email-only simulator build. SecureStore remains enabled.",
);

for (const file of walk("ios").filter(
  (file) => file.endsWith("/Info.plist") && !file.includes("/Pods/"),
)) {
  if (fs.readFileSync(file, "utf8").includes("NSFaceIDUsageDescription"))
    throw new Error("Email-only app does not request Face ID.");
}
console.log("PASS: no unused Face ID request in the email-only app.");
