"""Run repository verification locally, in Git hooks, and in CI."""
from __future__ import annotations
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = ("README.md", "LICENSE", "AGENTS.md", ".env.example", "docs/ARCHITECTURE.md", "docs/OPERATIONS.md", "docs/decisions/README.md")
PRIVATE_NAMES = {".env", "credentials.json", "secrets.json", "secrets.yaml", "id_rsa", "id_ed25519"}
GENERATED = {"node_modules", "dist", "data", "test-results", "playwright-report", "build", ".gradle"}
TEXT_SUFFIXES = {".css", ".env", ".groovy", ".html", ".js", ".json", ".md", ".py", ".sql", ".yaml", ".yml"}
SECRET_PATTERNS = (re.compile(r"AIza[0-9A-Za-z_-]{35}"), re.compile(r"\b(?:gsk_|github_pat_|sk-or-v1-)[A-Za-z0-9_-]{20,}"), re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"), re.compile(r"\bAKIA[0-9A-Z]{16}\b"), re.compile(r"\bgh[opurs]_[A-Za-z0-9_]{30,}\b"), re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b"), re.compile(r"\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*[\"']([A-Za-z0-9_./+=-]{12,})[\"']", re.I))

class Verification:
    def __init__(self): self.errors: list[str] = []
    def error(self, text: str): self.errors.append(text)
    def run(self, label: str, command: list[str]):
        print(f"[check] {label}")
        if subprocess.run(command, cwd=ROOT).returncode: self.error(f"{label} failed")

def git_files(checks: Verification) -> list[Path]:
    result = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=ROOT, capture_output=True)
    if result.returncode: checks.error("Could not list repository files"); return []
    return [ROOT / item.decode("utf-8") for item in result.stdout.split(b"\0") if item]

def main() -> int:
    checks = Verification(); files = git_files(checks)
    checks.run("git diff --check", ["git", "--no-pager", "diff", "--check"])
    checks.run("git diff --cached --check", ["git", "--no-pager", "diff", "--cached", "--check"])
    print("[check] required documentation")
    for path in REQUIRED:
        if not (ROOT / path).is_file(): checks.error(f"Missing essential documentation: {path}")
    print("[check] private, generated, large files, and potential secrets")
    for path in files:
        if not path.is_file(): continue
        relative = path.relative_to(ROOT); parts = {part.lower() for part in relative.parts}
        if path.name.lower() in PRIVATE_NAMES or (path.name.startswith(".env.") and path.name != ".env.example") or path.suffix.lower() in {".key", ".pem", ".p12", ".pfx"}: checks.error(f"Private file is not allowed: {relative}")
        if parts & GENERATED: checks.error(f"Generated file is not ignored: {relative}")
        if path.stat().st_size > 5 * 1024 * 1024: checks.error(f"File exceeds 5 MiB: {relative}")
        if path.stat().st_size > 1024 * 1024 or (path.suffix.lower() not in TEXT_SUFFIXES and path.name not in {"AGENTS.md", "Dockerfile", ".env.example"}): continue
        try: lines = path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError: continue
        for number, line in enumerate(lines, 1):
            if any(pattern.search(line) for pattern in SECRET_PATTERNS) and not re.search(r"replace-with|your-|example|placeholder|change-me", line, re.I): checks.error(f"Sensitive value candidate at {relative}:{number}"); break
    checks.run("tests", ["npm.cmd" if sys.platform == "win32" else "npm", "test"])
    checks.run("production build", ["npm.cmd" if sys.platform == "win32" else "npm", "run", "build"])
    if checks.errors:
        print("\nVerification failed:\n" + "\n".join(f"- {error}" for error in checks.errors)); return 1
    print("\nVerification completed successfully."); return 0

if __name__ == "__main__": raise SystemExit(main())
