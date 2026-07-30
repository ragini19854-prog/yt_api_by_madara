#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  Madara Music — One-command VPS deployment script
#  Works on Ubuntu 20.04+, Debian 11+, or any Docker-capable host.
#
#  Usage:
#    chmod +x deploy.sh
#    ./deploy.sh
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

# ── 1. Check prerequisites ────────────────────────────────────────
command -v docker >/dev/null 2>&1 || {
  echo "Docker not found. Installing..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed. Please log out and back in, then re-run this script."
  exit 1
}

command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1 || {
  echo "docker compose not found. Installing plugin..."
  sudo apt-get update -qq && sudo apt-get install -y docker-compose-plugin
}

# ── 2. Create .env if missing ──────────────────────────────────────
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo ""
    echo "✅ .env created from .env.example"
    echo "⚠️  Please edit .env and fill in real values, then re-run this script."
    echo ""
    exit 0
  else
    echo "Error: .env.example not found."
    exit 1
  fi
fi

# ── 3. Build and start ────────────────────────────────────────────
echo "🔨 Building images..."
docker compose build --no-cache

echo "🚀 Starting services..."
docker compose up -d

echo ""
echo "✅ Madara Music is running!"
echo "   Frontend: http://localhost:3000"
echo "   API:      http://localhost:8080/api/healthz"
echo ""
echo "To view logs:  docker compose logs -f"
echo "To stop:       docker compose down"
