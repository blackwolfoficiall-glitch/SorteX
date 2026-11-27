// Failure-only observation of fixture log metadata. No request/response body,
// identifiers, URLs, numeric status codes or redacted lines leave this callback.
const { readFileSync, lstatSync } = require("node:fs");
const { apiObservation } = require("../native-ui/login-failure-status.cjs");

const routes = [
  "/buyer/home",
  "/buyer/campaigns",
  "/public/campaigns/campanha-sintetica-ios",
];

function buyerReads(log) {
  if (log === null) return routes.map(() => "unknown");
  const buckets = routes.map(() => new Set());
  for (const line of log.split("\n")) {
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row?.method !== "GET" || typeof row.path !== "string") continue;
    const route = routes.indexOf(row.path.split("?", 1)[0]);
    if (route < 0) continue;
    const code = row.status;
    const bucket = !Number.isInteger(code) || code < 100 || code > 599
      ? "unknown" : code >= 200 && code < 300 ? "2xx" : "non-2xx";
    buckets[route].add(bucket);
  }
  return buckets.map((set) => set.size === 0
    ? "not-seen" : set.size > 1 ? "mixed" : set.values().next().value);
}

if (require.main === module) {
  let log = null;
  try {
    const path = process.argv[2];
    const stat = lstatSync(path);
    if (stat.isFile() && stat.size <= 1024 * 1024) log = readFileSync(path, "utf8");
  } catch {}
  const login = apiObservation(log);
  const [home, list, detail] = buyerReads(log);
  process.stdout.write(JSON.stringify({ ...login, home, list, detail }));
}
