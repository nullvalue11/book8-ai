#!/usr/bin/env bash
# Retry yarn install when the registry returns transient errors (e.g. 502).
set -u
max=5
delay=12
for ((attempt = 1; attempt <= max; attempt++)); do
  if yarn install --network-timeout 600000; then
    exit 0
  fi
  echo "yarn install failed (attempt $attempt/$max), waiting ${delay}s before retry..."
  if [ "$attempt" -lt "$max" ]; then
    sleep "$delay"
    delay=$((delay + 8))
  fi
done
exit 1
