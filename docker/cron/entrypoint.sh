#!/usr/bin/env bash
# Runs scripts/daily-track.sh (bind-mounted from the repo) on a schedule via
# busybox crond. Kept as its own container instead of baking cron into the
# app image since the app itself runs directly on the host (see Makefile),
# not in Docker - this container only exists to poke it on a timer.
set -euo pipefail

: "${CRON_SCHEDULE:=0 6 * * *}"

if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET env var is required" >&2
  exit 1
fi

# crond (busybox) runs job commands with the crond process's own environment,
# so APP_URL/CRON_SECRET set via `docker compose environment:` reach the
# script without needing to be re-exported per job.
echo "${CRON_SCHEDULE} /scripts/daily-track.sh >> /var/log/cron.log 2>&1" > /etc/crontabs/root
touch /var/log/cron.log

echo "aso-cron: scheduling '${CRON_SCHEDULE}' against ${APP_URL:-http://localhost:3000}"

crond -f -l 2 &
tail -f /var/log/cron.log
