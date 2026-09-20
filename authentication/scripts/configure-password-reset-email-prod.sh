#!/usr/bin/env bash
set -euo pipefail

env_file="/srv/pokegonexus/authentication/.env"
if [[ ! -f "$env_file" ]]; then
  printf 'Authentication environment file not found: %s\n' "$env_file" >&2
  exit 1
fi

printf 'Configuring password reset email in %s\n' "$env_file"
read -r -s -p 'Resend API key (input hidden): ' resend_api_key
printf '\n'
if [[ "$resend_api_key" != re_* ]]; then
  printf 'The API key does not look like a Resend API key.\n' >&2
  exit 1
fi

backup="${env_file}.bak.$(date -u +%Y%m%dT%H%M%SZ)"
cp "$env_file" "$backup"
sed -i '/^RESEND_API_KEY=/d;/^PASSWORD_RESET_FROM=/d;/^PASSWORD_RESET_REPLY_TO=/d' "$env_file"
{
  printf 'RESEND_API_KEY=%s\n' "$resend_api_key"
  printf 'PASSWORD_RESET_FROM=%s\n' 'Pokémon Go Nexus Accounts <accounts@mail.pokegonexus.com>'
  printf 'PASSWORD_RESET_REPLY_TO=%s\n' 'accounts@pokegonexus.com'
} >> "$env_file"
chmod 600 "$env_file"
unset resend_api_key

printf 'Password reset email settings installed.\n'
printf 'Backup: %s\n' "$backup"
printf 'The auth service has not been restarted or deployed yet.\n'
