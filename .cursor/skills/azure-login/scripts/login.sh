#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$root" ]]; then
  echo "Run this from the clocked-in git repo." >&2
  exit 1
fi

env_file="$root/.env"
if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file. Add AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID." >&2
  exit 1
fi

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI is not installed. Run: brew install azure-cli" >&2
  exit 1
fi

load_var() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$env_file" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    echo "Missing $key in .env" >&2
    exit 1
  fi
  local value="${line#*=}"
  value="${value%$'\r'}"
  if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "${value}" == \'*\' && "${value}" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "$value"
}

client_id="$(load_var AZURE_CLIENT_ID)"
client_secret="$(load_var AZURE_CLIENT_SECRET)"
tenant_id="$(load_var AZURE_TENANT_ID)"

az login --service-principal \
  --username "$client_id" \
  --password "$client_secret" \
  --tenant "$tenant_id" \
  --output none

az account show --query "{name:name, id:id, tenantId:tenantId}" --output json
