#!/usr/bin/env bash
# Unattended batch driver: runs batch files in order through run-loop.ts with a
# quality gate between batches. Stops if the failure rate or checklist-fail
# rate of the batch just completed exceeds thresholds — a crater means a code
# or upstream problem that re-running won't fix.
#
#   scripts/batch/drive.sh [start-batch-number] [concurrency]
set -uo pipefail
cd "$(dirname "$0")/../.."

START="${1:-1}"
CONC="${2:-2}"
OUT=scripts/batch/results-full
MODEL=gpt-5.4-mini
MAX_FAIL_PCT=25   # loop failures (rate limits, crashes) per batch
MAX_CHECK_PCT=20  # checklist failures per batch

for f in $(ls scripts/batch/batches/batch-*.txt | sort); do
  n=$(basename "$f" .txt | sed 's/batch-0*//')
  [ "$n" -lt "$START" ] && continue
  total=$(grep -cv '^\s*$' "$f")
  before_fail=$(wc -l < "$OUT/_failures.jsonl" 2>/dev/null || echo 0)

  echo "=== batch $n ($total domains, concurrency $CONC) $(date '+%H:%M') ==="
  bun scripts/batch/run-loop.ts --domains "$f" --model "$MODEL" --concurrency "$CONC" --out "$OUT" 2>&1 |
    grep -vE '^dedup:' | tail -4

  after_fail=$(wc -l < "$OUT/_failures.jsonl" 2>/dev/null || echo 0)
  new_fail=$((after_fail - before_fail))
  fail_pct=$((new_fail * 100 / total))
  echo "batch $n: loop failures $new_fail/$total (${fail_pct}%)"
  if [ "$fail_pct" -gt "$MAX_FAIL_PCT" ]; then
    echo "GATE: failure rate ${fail_pct}% > ${MAX_FAIL_PCT}% — stopping after batch $n"
    exit 2
  fi

  # Checklist over THIS batch's domains only.
  check_out=$(bun scripts/batch/check-results.ts --dir "$OUT" 2>&1 | grep -Ff <(sed 's/$/\t/' "$f") || true)
  checked=$(echo "$check_out" | grep -c . || true)
  bad=$(echo "$check_out" | grep -cw fail || true)
  if [ "${checked:-0}" -gt 0 ]; then
    check_pct=$((bad * 100 / checked))
    echo "batch $n: checklist $bad/$checked fail (${check_pct}%)"
    if [ "$check_pct" -gt "$MAX_CHECK_PCT" ]; then
      echo "GATE: checklist fail rate ${check_pct}% > ${MAX_CHECK_PCT}% — stopping after batch $n"
      exit 3
    fi
  fi
done
echo "=== all batches complete $(date '+%H:%M') ==="
