#!/usr/bin/env bash
# physlane weekly D1 snapshot (roadmap Phase 1.3). Zero-token, no agent.
# Writes YYYY-Www.json into ~/Developer/physlane-snapshots/ and prints a
# one-line summary (cron delivery surface). Run: scripts/d1-snapshot.sh
set -euo pipefail
cd "$(dirname "$0")/.."

OUT_DIR="$HOME/Developer/physlane-snapshots"
mkdir -p "$OUT_DIR"
STAMP="$(date +%G-W%V)"
OUT="$OUT_DIR/$STAMP.json"

# Single pivoted query: wrangler --json only returns rows for one statement.
QUERY="SELECT
 (SELECT COUNT(*) FROM user) AS users_total,
 (SELECT COUNT(*) FROM user WHERE plan = 'pro') AS users_pro,
 (SELECT COUNT(*) FROM waitlist) AS waitlist_total,
 (SELECT COUNT(*) FROM measurements) AS weight_logs,
 (SELECT COUNT(*) FROM daily_intake) AS intake_logs,
 (SELECT COUNT(*) FROM (
    SELECT m.user_id FROM measurements m
    JOIN daily_intake i ON i.user_id = m.user_id
    GROUP BY m.user_id
    HAVING COUNT(DISTINCT date(m.taken_at, 'unixepoch')) >= 14
       AND COUNT(DISTINCT i.date) >= 14
 )) AS day14_completions;"

npx wrangler d1 execute physlane --remote --json --command "$QUERY" \
  | python3 -c "
import json, sys, time
text = sys.stdin.read()
# wrangler prints banner lines before the JSON; skip to the first JSON line
lines = text.splitlines()
start = next(i for i, l in enumerate(lines) if l.lstrip().startswith(('[', '{')))
raw = json.loads('\n'.join(lines[start:]))
if isinstance(raw, list):
    raw = raw[0]
metrics = raw['results'][0]
snap = {'week': '$STAMP', 'takenAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), **metrics}
print(json.dumps(snap, indent=2))
" > "$OUT"

cat "$OUT"
echo "snapshot: $OUT"
