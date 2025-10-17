#!/bin/bash

# CI Guard: Prevent process.env usage outside lib/env.js

set -e

echo "🔍 Checking for process.env usage outside lib/env.js..."

# Search for process.env in source files, excluding:
# - node_modules
# - .next build directory
# - lib/env.js and app/lib/env.js (the only allowed locations)
# - scripts directory (tooling)

FOUND=$(grep -r "process\.env\." \
  --include="*.js" \
  --include="*.jsx" \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude-dir="node_modules" \
  --exclude-dir=".next" \
  --exclude="env.js" \
  --exclude-dir="scripts" \
  --exclude-dir="tests" \
  app/ 2>/dev/null || true)

if [ -n "$FOUND" ]; then
  echo "❌ FAILED: process.env usage detected outside lib/env.js:"
  echo ""
  echo "$FOUND"
  echo ""
  echo "All environment variable access must go through the centralized env module."
  echo "Import with: import { env } from '@/app/lib/env'"
  exit 1
fi

echo "✅ PASSED: No unauthorized process.env usage found"
exit 0
