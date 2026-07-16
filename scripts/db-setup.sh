#!/usr/bin/env bash
# Creates the local dev role + database on the system Postgres.
# Idempotent: safe to re-run.
set -euo pipefail

sudo -u postgres psql <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wedding') THEN
    CREATE ROLE wedding LOGIN PASSWORD 'wedding' CREATEDB;
  END IF;
END
$$;
SQL

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'wedding_game'" |
  grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE wedding_game OWNER wedding"

echo "OK: postgres://wedding:wedding@localhost:5432/wedding_game"
