"""Generate the changelog and ADR drafts from local Git history."""
from __future__ import annotations
import argparse
import re
import subprocess
import unicodedata
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DECISIONS = ROOT / "docs" / "decisions"
CATEGORIES = (("feat", "Features"), ("fix", "Fixes"), ("style", "Visual presentation"), ("refactor", "Refactors"), ("docs", "Documentation"), ("test", "Tests"), ("chore", "Maintenance"))
CONVENTIONAL = re.compile(rf"^({'|'.join(kind for kind, _ in CATEGORIES)})(?:\([^)]+\))?!?:\s+(.+)$", re.I)

def git(*args: str) -> str:
    return subprocess.run(["git", "-C", str(ROOT), *args], check=True, capture_output=True, text=True, encoding="utf-8").stdout

def changelog() -> None:
    records: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for entry in git("log", "--pretty=format:%h%x1f%s%x1e").split("\x1e"):
        entry = entry.strip()
        if not entry or "\x1f" not in entry: continue
        commit_hash, subject = entry.split("\x1f", 1)
        match = CONVENTIONAL.match(subject)
        records[match.group(1).lower() if match else "other"].append((commit_hash, match.group(2) if match else subject))
    lines = ["# Changelog", "", "Generated deterministically from Git history.", ""]
    for kind, heading in (*CATEGORIES, ("other", "Other changes")):
        if records[kind]: lines.extend([f"## {heading}", "", *(f"- {subject} (`{commit_hash}`)" for commit_hash, subject in records[kind]), ""])
    (ROOT / "CHANGELOG.md").write_text("\n".join(lines), encoding="utf-8")
    print("CHANGELOG.md updated.")

def decision(title: str) -> None:
    slug = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()).strip("-")
    if not slug: raise SystemExit("The title must contain letters or numbers.")
    DECISIONS.mkdir(parents=True, exist_ok=True)
    numbers = [int(path.name[:4]) for path in DECISIONS.glob("[0-9][0-9][0-9][0-9]-*.md")]
    target = DECISIONS / f"{max(numbers, default=0)+1:04d}-{slug}.md"
    target.write_text(f"# {title}\n\nDate: {date.today().isoformat()}\nStatus: proposed\n\n## Context\n\n<!-- Situation, constraints, and alternatives. -->\n\n## Decision\n\n<!-- Selected option and rationale. -->\n\n## Consequences\n\n<!-- Benefits, costs, risks, and follow-up work. -->\n", encoding="utf-8")
    print(target.relative_to(ROOT))

parser = argparse.ArgumentParser(description=__doc__)
commands = parser.add_subparsers(dest="command", required=True)
commands.add_parser("changelog")
new = commands.add_parser("decision"); new.add_argument("title")
arguments = parser.parse_args()
changelog() if arguments.command == "changelog" else decision(arguments.title)
