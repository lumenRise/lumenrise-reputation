#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
api_dir="${LUMENRISE_API_PATH:-$(cd "$repo_dir/../lumenrise-api" && pwd)}"

if [[ "$(node --version)" != v24.* ]]; then
  echo 'Node 24 is required.' >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  compose=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose=(docker-compose)
else
  echo 'Docker Compose is required.' >&2
  exit 1
fi

cleanup() {
  "${compose[@]}" -f "$repo_dir/compose.test.yml" down --volumes
}
trap cleanup EXIT

"${compose[@]}" -f "$repo_dir/compose.test.yml" up --detach mongo rabbitmq
"${compose[@]}" -f "$repo_dir/compose.test.yml" run --rm mongo-init
for attempt in {1..30}; do
  if "${compose[@]}" -f "$repo_dir/compose.test.yml" exec -T rabbitmq rabbitmq-diagnostics -q ping; then
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then
    echo 'RabbitMQ did not become healthy.' >&2
    exit 1
  fi
  sleep 2
done

export NODE_ENV=test
export DB_URI='mongodb://127.0.0.1:27019/?replicaSet=rs0&directConnection=true'
export DB_NAME='lumenrise_integration_test'
export RABBITMQ_URL='amqp://127.0.0.1:5673'
export LUMENRISE_TEST_DB_URI="$DB_URI"
export LUMENRISE_TEST_RABBITMQ_URL="$RABBITMQ_URL"
export LUMENRISE_API_PATH="$api_dir"
export CREDENTIAL_ENCRYPTION_KEY='0000000000000000000000000000000000000000000000000000000000000000'

npm --prefix "$api_dir" run build
npm --prefix "$api_dir" run lint
npm --prefix "$api_dir" run migrate
npm --prefix "$api_dir" test -- --maxWorkers=4
npm --prefix "$repo_dir" run build
(
  cd "$repo_dir"
  "$api_dir/node_modules/.bin/eslint" --config "$api_dir/eslint.config.mjs" src tests
)
npm --prefix "$repo_dir" test
npm --prefix "$repo_dir" run test:integration
LUMENRISE_TEST_BROKER_OUTAGE=1 LUMENRISE_TEST_RABBITMQ_URL='amqp://127.0.0.1:5674' \
  npm --prefix "$repo_dir" run test:integration
npm --prefix "$repo_dir" run check:model-parity
