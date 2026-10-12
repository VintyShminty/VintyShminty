"""Turns Semgrep's JSON report into a short job summary and decides pass or fail.

Findings at severity ERROR block the pull request. WARNING, INFO and anything else is
listed but never fails the job. Usage: semgrep-summary.py <report.json> <summary.md>
"""

import json
import sys
from collections import Counter

report_path, summary_path = sys.argv[1], sys.argv[2]
with open(report_path) as f:
    report = json.load(f)

results = report.get("results", [])
errors = [r for r in results if r["extra"]["severity"] == "ERROR"]
others = [r for r in results if r["extra"]["severity"] != "ERROR"]


def rule_name(result):
    return result["check_id"].split(".")[-1]


def lines_for(items):
    counts = Counter((rule_name(r), r["path"], r["start"]["line"]) for r in items)
    return [f"- `{rule}` at `{path}:{line}`" for (rule, path, line) in sorted(counts)]


out = ["## Semgrep", ""]
out.append(f"Blocking findings (severity ERROR): **{len(errors)}**")
out.append(f"Reported only (WARNING, INFO and other): **{len(others)}**")
out.append(f"Files scanned: {len(report.get('paths', {}).get('scanned', []))}")
out.append("")
if errors:
    out.append("### Blocking")
    out += lines_for(errors)
    out.append("")
if others:
    out.append("### Reported, not blocking")
    out += lines_for(others)
    out.append("")
if report.get("errors"):
    out.append(f"Semgrep reported {len(report['errors'])} scan errors, see the job log.")
if not results:
    out.append("No findings.")

text = "\n".join(out) + "\n"
with open(summary_path, "a") as f:
    f.write(text)
print(text)

sys.exit(1 if errors else 0)
