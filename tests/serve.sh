#!/usr/bin/env bash
# Starts the mock providers and the app wired to them, for `npm run test:api`
# and `npm run test:flows`. No real keys, money or identity data are involved.
set -euo pipefail
cd "$(dirname "$0")/.."

export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon-key
export SUPABASE_SERVICE_ROLE_KEY=mock-service-role-key
export PAYSTACK_SECRET_KEY=sk_test_mock
export NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_mock
export QOREID_CLIENT_ID=mock-qore-client
export QOREID_CLIENT_SECRET=mock-qore-secret
export QOREID_AUTH_URL=https://api.qoreid.com/token
export MONO_SEC_KEY=mock-mono-key
export NEXT_TELEMETRY_DISABLED=1
unset GCP_SERVICE_ACCOUNT_KEY_BASE64

node tests/mock/upstreams.mjs &
MOCK_PID=$!
trap 'kill $MOCK_PID 2>/dev/null || true' EXIT

npx next build
NODE_OPTIONS="--require $PWD/tests/mock/redirect-upstreams.cjs" npx next start -p "${PORT:-3000}"
