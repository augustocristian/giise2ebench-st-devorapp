#!/usr/bin/env python3
"""Write a Markdown test summary to the GitHub Actions job summary tab.

Reads JUnit XML (Selenium/Surefire, Cypress/mocha-junit) or TRX (Playwright for .NET) reports
and appends totals, a per-class table and the failing tests to $GITHUB_STEP_SUMMARY
(or prints to stdout when the variable is not set).

Usage: test_summary.py --title "Selenium + Java" --format junit 'selenium-java/target/**/TEST-*.xml'
"""
import argparse
import glob
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import OrderedDict

MAX_FAILURES = 20
MAX_MESSAGE = 300


def local(tag):
    """Tag name without its XML namespace."""
    return tag.rsplit("}", 1)[-1]


def first_line(text, limit=MAX_MESSAGE):
    text = (text or "").strip().splitlines()
    line = text[0].strip() if text else ""
    return (line[: limit - 1] + "…") if len(line) > limit else line


def parse_junit(path):
    """Yield (group, name, outcome, seconds, message) for every test case."""
    root = ET.parse(path).getroot()
    rows = []
    for case in root.iter("testcase"):
        outcome, message = "passed", ""
        for child in case:
            tag = local(child.tag)
            if tag in ("failure", "error"):
                outcome = "failed" if tag == "failure" else "error"
                message = child.get("message") or child.text or ""
            elif tag == "skipped":
                outcome = "skipped"
        group = (case.get("classname") or case.get("name") or "tests").rsplit(".", 1)[-1]
        rows.append([group, case.get("name", ""), outcome, float(case.get("time") or 0), message])
    # Some reporters (Cypress' after:spec) only know the whole-spec time: share it between the cases.
    suite_time = float(root.get("time") or 0) if local(root.tag) == "testsuite" else 0.0
    if rows and not any(row[3] for row in rows) and suite_time:
        for row in rows:
            row[3] = suite_time / len(rows)
    yield from (tuple(row) for row in rows)


def parse_duration(value):
    """TRX duration 'hh:mm:ss.fffffff' to seconds."""
    match = re.match(r"(\d+):(\d+):(\d+(?:\.\d+)?)", value or "")
    if not match:
        return 0.0
    hours, minutes, seconds = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def parse_trx(path):
    root = ET.parse(path).getroot()
    classes = {}
    for unit in root.iter():
        if local(unit.tag) == "UnitTest":
            for method in unit:
                if local(method.tag) == "TestMethod":
                    classes[unit.get("id")] = method.get("className", "")
    for result in root.iter():
        if local(result.tag) != "UnitTestResult":
            continue
        outcome = {"Passed": "passed", "Failed": "failed", "NotExecuted": "skipped"}.get(result.get("outcome"), "error")
        message = ""
        for node in result.iter():
            if local(node.tag) == "Message":
                message = node.text or ""
                break
        group = classes.get(result.get("testId"), "").rsplit(".", 1)[-1]
        yield (group or "tests", result.get("testName", ""), outcome, parse_duration(result.get("duration")), message)


def fmt_seconds(seconds):
    minutes, secs = divmod(seconds, 60)
    return f"{int(minutes)}m {secs:04.1f}s" if minutes else f"{secs:.1f}s"


def render(title, results, files):
    total = len(results)
    counts = {key: sum(1 for r in results if r[2] == key) for key in ("passed", "failed", "error", "skipped")}
    seconds = sum(r[3] for r in results)
    ok = total > 0 and counts["failed"] == 0 and counts["error"] == 0
    icon = "✅" if ok else "❌"
    lines = [f"### {icon} {title}", ""]
    if total == 0:
        lines += [f"No test results found ({len(files)} report file(s)). Did the test run crash before writing reports?", ""]
        return "\n".join(lines)

    lines += [
        "| Total | ✅ Passed | ❌ Failed | 💥 Errors | ⏭️ Skipped | ⏱️ Duration |",
        "|---:|---:|---:|---:|---:|---:|",
        f"| {total} | {counts['passed']} | {counts['failed']} | {counts['error']} | {counts['skipped']} | {fmt_seconds(seconds)} |",
        "",
    ]

    groups = OrderedDict()
    for group, _name, outcome, secs, _msg in results:
        entry = groups.setdefault(group, [0, 0, 0.0])
        entry[0] += 1
        entry[1] += 0 if outcome in ("passed", "skipped") else 1
        entry[2] += secs
    lines += ["<details><summary>By class / suite</summary>", "", "| Class / suite | Tests | Failing | Time |", "|---|---:|---:|---:|"]
    for group, (count, bad, secs) in sorted(groups.items()):
        lines.append(f"| {group} | {count} | {bad if bad else '–'} | {fmt_seconds(secs)} |")
    lines += ["", "</details>", ""]

    failing = [r for r in results if r[2] in ("failed", "error")]
    if failing:
        lines += [f"**Failing tests ({len(failing)})**", ""]
        for group, name, _outcome, _secs, message in failing[:MAX_FAILURES]:
            lines.append(f"- `{group}` › {name}: {first_line(message)}")
        if len(failing) > MAX_FAILURES:
            lines.append(f"- … and {len(failing) - MAX_FAILURES} more")
        lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--title", required=True)
    parser.add_argument("--format", choices=("junit", "trx"), required=True)
    parser.add_argument("patterns", nargs="+", help="glob patterns of report files")
    args = parser.parse_args()

    files = sorted({f for pattern in args.patterns for f in glob.glob(pattern, recursive=True)})
    parse = parse_junit if args.format == "junit" else parse_trx
    results = []
    for path in files:
        try:
            results.extend(parse(path))
        except ET.ParseError as error:
            print(f"warning: cannot parse {path}: {error}", file=sys.stderr)

    markdown = render(args.title, results, files)
    target = os.environ.get("GITHUB_STEP_SUMMARY")
    if target:
        with open(target, "a", encoding="utf-8") as handle:
            handle.write(markdown + "\n")
    else:
        sys.stdout.reconfigure(encoding="utf-8")  # emoji in the tables: Windows consoles default to cp1252
        print(markdown)


if __name__ == "__main__":
    main()
