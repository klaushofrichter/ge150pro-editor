// npm audit --audit-level=high, minus advisories ignored until a date: an advisory with no fixed version yet that
// reaches only the build and test tools. Each entry expires; after that date the audit fails on it again.
import { execFileSync } from "node:child_process";

const IGNORE = {
  // picomatch ReDoS (all versions, no fix yet); only via vite, vitest and svelte-check. Decided 2026-11-17.
  "https://github.com/advisories/GHSA-fc5q-39xc-vjpf": "2026-12-17",
};
const HIGH = new Set(["high", "critical"]);
const today = new Date().toISOString().slice(0, 10);
const ignored = (url) => IGNORE[url] && today <= IGNORE[url];

let out;
try {
  out = execFileSync("npm", ["audit", "--json"], { encoding: "utf8" });
} catch (e) {
  out = e.stdout; // npm audit exits non-zero when it finds anything
}
const vulns = JSON.parse(out).vulnerabilities ?? {};

// A package counts when one of its own high advisories is not ignored, or it depends on a package that counts.
const memo = new Map();
function counts(name, seen = new Set()) {
  if (memo.has(name)) return memo.get(name);
  if (seen.has(name) || !vulns[name]) return false;
  seen.add(name);
  const r = vulns[name].via.some((v) =>
    typeof v === "string"
      ? counts(v, seen)
      : HIGH.has(v.severity) && !ignored(v.url),
  );
  memo.set(name, r);
  return r;
}
const failing = Object.keys(vulns).filter((n) => counts(n));
for (const [url, until] of Object.entries(IGNORE))
  console.log(
    `${today <= until ? "ignoring" : "expired, not ignoring"} ${url} (until ${until})`,
  );
if (failing.length) {
  console.error(`high severity vulnerabilities: ${failing.join(", ")}`);
  process.exit(1);
}
console.log(
  "npm audit: no high severity vulnerabilities besides the ignored ones",
);
