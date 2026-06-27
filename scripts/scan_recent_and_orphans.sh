#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

find . -type f ! -path './.git/*' -printf '%P\n' | sort > /tmp/recruiterreply_all_files.txt
all_count=$(wc -l < /tmp/recruiterreply_all_files.txt)

find . -type f ! -path './.git/*' -mtime -14 -printf '%TY-%Tm-%Td %TH:%TM:%TS|%P\n' | sort -r > /tmp/recruiterreply_recent_files.txt
recent_count=$(wc -l < /tmp/recruiterreply_recent_files.txt)

: > /tmp/recruiterreply_orphan_candidates.txt

while IFS= read -r rel; do
  base="$(basename "$rel")"

  path_hits=$(git grep -l -F -- "$rel" 2>/dev/null | grep -vxF "$rel" | wc -l || true)
  base_hits=$(git grep -l -F -- "$base" 2>/dev/null | grep -vxF "$rel" | wc -l || true)

  if [[ "$path_hits" -eq 0 ]]; then
    path_hits=$(grep -RIl --exclude-dir=.git --binary-files=without-match -F "$rel" . 2>/dev/null | sed 's|^\./||' | grep -vxF "$rel" | wc -l || true)
  fi
  if [[ "$base_hits" -eq 0 ]]; then
    base_hits=$(grep -RIl --exclude-dir=.git --binary-files=without-match -F "$base" . 2>/dev/null | sed 's|^\./||' | grep -vxF "$rel" | wc -l || true)
  fi

  if [[ "$path_hits" -eq 0 && "$base_hits" -eq 0 ]]; then
    echo "$rel" >> /tmp/recruiterreply_orphan_candidates.txt
  fi
done < /tmp/recruiterreply_all_files.txt

orphan_count=$(wc -l < /tmp/recruiterreply_orphan_candidates.txt)

{
  echo "# Recently Edited Files"
  echo "Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "Total files scanned: $all_count"
  echo "Recent files (mtime <= 14 days): $recent_count"
  echo
  cat /tmp/recruiterreply_recent_files.txt
} > docs/RECENT_FILES_REPORT.md

{
  echo "# Orphan Candidate Files"
  echo "Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "Total files scanned: $all_count"
  echo "Orphan candidates: $orphan_count"
  echo
  echo "Heuristic: file path and basename are not found in any other files."
  echo "Note: runtime-loaded assets/config can be false positives."
  echo
  cat /tmp/recruiterreply_orphan_candidates.txt
} > docs/ORPHAN_CANDIDATES_REPORT.md

echo "all_files=$all_count"
echo "recent_files=$recent_count"
echo "orphan_candidates=$orphan_count"
echo "recent_report=docs/RECENT_FILES_REPORT.md"
echo "orphan_report=docs/ORPHAN_CANDIDATES_REPORT.md"
