#!/usr/bin/env bash
# Triggers the daily rank-tracking pass. Point this at your running instance
# and schedule it once a day, e.g. via crontab:
#   0 6 * * * APP_URL=http://localhost:3000 CRON_SECRET=... /path/to/daily-track.sh >> /var/log/aso-track.log 2>&1
set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET env var is required" >&2
  exit 1
fi

curl -fsS -X POST "$APP_URL/api/track" -H "Authorization: Bearer $CRON_SECRET"
echo
