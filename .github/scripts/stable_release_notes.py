"""
Print the release notes for a stable .post release.

Lists the main PRs cherry-picked onto stable since the previous stable release,
formatted with the categories and templates of .github/release-drafter.yml.

Usage: stable_release_notes.py <version> [<rev>]

Needs an authenticated `gh` CLI.
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

import yaml

CONFIG = Path(__file__).parent.parent / "release-drafter.yml"
REPO = os.environ.get("GITHUB_REPOSITORY", "music-assistant/frontend")
VERSION_RE = re.compile(r"^(\d+\.\d+\.\d+)\.post(\d+)$")
PR_SUBJECT_RE = re.compile(r"\(#(\d+)\)$")
CHERRY_PICK_RE = re.compile(r"^\(cherry picked from commit ([0-9a-f]{40})\)$", re.MULTILINE)


def main(version: str, rev: str = "HEAD") -> None:
    """
    Print the release notes for a stable .post release.

    :param version: The .post version being released, e.g. 2.17.297.post2.
    :param rev: The commit the release is built from.
    """
    match = VERSION_RE.match(version)
    if not match:
        sys.exit(f"{version} is not a .post version")
    base = match.group(1)
    config = yaml.safe_load(CONFIG.read_text())

    commits = f"{_previous_release(base, version, rev)}..{rev}"
    prs = [_gh_api(f"repos/{REPO}/pulls/{number}") for number in sorted(_picked_prs(commits))]
    prs = [pr for pr in prs if pr["base"]["ref"] == "main" and pr["merged_at"]]
    prs.sort(key=lambda pr: pr["merged_at"], reverse=True)

    notes = config["template"]
    notes = notes.replace("$CHANGES", _changes(prs, config))
    notes = notes.replace("$CONTRIBUTORS", _contributors(prs, config))
    print(f"Bug fixes from main, backported onto {base}.\n{notes}")


def _previous_release(base: str, version: str, rev: str) -> str:
    """Return the latest stable release tag that `rev` contains, other than `version`."""
    tags = _git("tag", "--merged", rev, "--list", base, f"{base}.post*").split()
    posts = {
        tag: int(match.group(2)) if (match := VERSION_RE.match(tag)) else 0
        for tag in tags
        if tag != version and (tag == base or VERSION_RE.match(tag))
    }
    if not posts:
        sys.exit(f"{rev} does not contain {base}")
    return max(posts, key=lambda tag: posts[tag])


def _picked_prs(commits: str) -> set[int]:
    """Return the PR numbers referenced by the commits in a range."""
    numbers = {
        int(match.group(1))
        for subject in _git("log", "--format=%s", commits).splitlines()
        if (match := PR_SUBJECT_RE.search(subject))
    }
    for sha in CHERRY_PICK_RE.findall(_git("log", "--format=%B", commits)):
        numbers.update(pr["number"] for pr in _gh_api(f"repos/{REPO}/commits/{sha}/pulls"))
    return numbers


def _changes(prs: list[dict], config: dict) -> str:
    """Render the PRs grouped by the release-drafter categories."""
    categories = config.get("categories", [])
    grouped: dict[int, list[str]] = {}
    for pr in prs:
        labels = {label["name"] for label in pr["labels"]}
        index = next(
            (
                i
                for i, category in enumerate(categories)
                if labels & {name for rule in category["when"] for name in rule["labels"]}
            ),
            -1,
        )
        grouped.setdefault(index, []).append(_change(pr, config))

    sections = grouped.get(-1, [])
    for i, category in enumerate(categories):
        if not (items := grouped.get(i)):
            continue
        body = "\n".join(items)
        if (collapse := category.get("collapse-after")) is not None and len(items) > collapse:
            body = f"<details>\n<summary>{len(items)} changes</summary>\n\n{body}\n</details>"
        heading = config.get("category-template", "## $TITLE").replace("$TITLE", category["title"])
        sections.append(f"\n{heading}\n\n{body}")
    return "\n".join(sections).strip()


def _change(pr: dict, config: dict) -> str:
    """Render one PR with the release-drafter change template."""
    return (
        config["change-template"]
        .replace("$TITLE", pr["title"])
        .replace("$AUTHOR", pr["user"]["login"])
        .replace("$NUMBER", str(pr["number"]))
    )


def _contributors(prs: list[dict], config: dict) -> str:
    """Render the PR authors the way release-drafter lists contributors."""
    excluded = set(config.get("exclude-contributors", []))
    authors = list(
        dict.fromkeys(
            f"@{pr['user']['login']}"
            for pr in prs
            if pr["user"]["login"] not in excluded and pr["user"]["type"] != "Bot"
        )
    )
    if len(authors) < 2:
        return "".join(authors) or config.get("no-contributors-template", "No contributors")
    return f"{', '.join(authors[:-1])} and {authors[-1]}"


def _git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def _gh_api(endpoint: str) -> dict | list:
    result = subprocess.run(["gh", "api", endpoint], check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


if __name__ == "__main__":
    main(*sys.argv[1:])
