#!/usr/bin/env bash
# Check that dist/ holds exactly one wheel and one source distribution, and
# that both actually ship the built frontend. Run from the repository root
# after `python3 -m build`.
#
# The exit code of `python3 -m build` says nothing about the payload: an
# absent music_assistant_frontend/ or a broken MANIFEST.in graft still builds
# cleanly and yields a metadata-only package.
set -euo pipefail
shopt -s nullglob

MARKER="music_assistant_frontend/index.html"

WHEELS=(dist/*.whl)
SDISTS=(dist/*.tar.gz)
if (( ${#WHEELS[@]} != 1 || ${#SDISTS[@]} != 1 )); then
  echo "::error::Expected one wheel and one source distribution in dist/."
  exit 1
fi

WHEEL_FILES=$(unzip -Z1 "${WHEELS[0]}")
if ! grep -Fqx "$MARKER" <<< "$WHEEL_FILES"; then
  echo "::error::${WHEELS[0]##*/} does not contain $MARKER."
  exit 1
fi

# Strip the <name>-<version>/ directory every sdist entry sits under, so the
# marker can be matched whole-line rather than as a substring.
SDIST_FILES=$(tar -tzf "${SDISTS[0]}" | cut -d/ -f2-)
if ! grep -Fqx "$MARKER" <<< "$SDIST_FILES"; then
  echo "::error::${SDISTS[0]##*/} does not contain $MARKER."
  exit 1
fi

echo "${WHEELS[0]##*/} and ${SDISTS[0]##*/} ship the built frontend."
