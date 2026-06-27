#!/usr/bin/env bash
set -euo pipefail

cd "${1:-.}"

EXCLUDE_RE='^(\.git/|frontend/node_modules/|frontend/dist/|backend/bin/|backend/obj/|infra/aws/terraform/\.terraform/|infra/aws/rout53/\.terraform/|infra/aws/terraform/terraform\.tfstate(\.backup)?$|infra/aws/rout53/terraform\.tfstate(\.backup)?$)'

# Limit to tracked, human-maintained files for a conservative "safe delete" pass.
git ls-files \
  | grep -Ev "$EXCLUDE_RE" \
  | grep -E '\.(md|txt|yml|yaml|json|tf|tfvars|cs|ts|tsx|js|jsx|sql|sh|conf|config|example|env)$|(^Dockerfile$)|(/Dockerfile$)' \
  > /tmp/recruiterreply_safe_delete_pool.txt

pool_count=$(wc -l < /tmp/recruiterreply_safe_delete_pool.txt)
: > /tmp/recruiterreply_safe_delete_candidates.txt

while IFS= read -r rel; do
  base="$(basename "$rel")"

  # Search references by full relative path and basename in tracked files.
  path_hits=$(git grep -l -F -- "$rel" 2>/dev/null | grep -vxF "$rel" | wc -l || true)
  base_hits=$(git grep -l -F -- "$base" 2>/dev/null | grep -vxF "$rel" | wc -l || true)

  if [[ "$path_hits" -eq 0 && "$base_hits" -eq 0 ]]; then
    echo "$rel" >> /tmp/recruiterreply_safe_delete_candidates.txt
  fi
done < /tmp/recruiterreply_safe_delete_pool.txt

cand_count=$(wc -l < /tmp/recruiterreply_safe_delete_candidates.txt)

{
  echo "# Safe Delete Candidates"
  echo "Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "Method: conservative tracked-file scan"
  echo "Scanned pool size: ${pool_count}"
  echo "Candidates: ${cand_count}"
  echo
  echo "Exclusions applied: node_modules, dist, bin, obj, .terraform, terraform state files"
  echo "Candidate rule: no references found by relative path OR basename in other tracked files"
  echo ""
  echo "Review each candidate before deletion (runtime discovery and manual usage may not be text-referenced)."
  echo
  cat /tmp/recruiterreply_safe_delete_candidates.txt
} > docs/SAFE_DELETE_CANDIDATES_REPORT.md

echo "pool_count=$pool_count"
echo "safe_delete_candidates=$cand_count"
echo "report=docs/SAFE_DELETE_CANDIDATES_REPORT.md"
