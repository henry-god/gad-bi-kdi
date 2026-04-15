#!/bin/bash
# KGD First-Time Setup Script
set -e

echo "🇰🇭 Setting up Khmer Government Document Platform..."

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install Node.js 20+ first."
  exit 1
fi
echo "✅ Node.js $(node -v)"

# Check npm
echo "✅ npm $(npm -v)"

# Install Node dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Copy env file
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "📝 Created .env.local — fill in your API keys!"
else
  echo "✅ .env.local already exists"
fi

# Check Docker (optional)
if command -v docker &> /dev/null; then
  echo "✅ Docker found — run 'docker-compose -f config/docker-compose.yml up -d' for dev services"
else
  echo "⚠️  Docker not found — PostgreSQL/MinIO/ChromaDB need manual setup (Phase 2+)"
fi

# Verify template configs
TEMPLATE_COUNT=$(ls templates/config/*.json 2>/dev/null | grep -v _template | wc -l)
echo "✅ Found $TEMPLATE_COUNT template configs"

# Verify knowledge rules
RULES_COUNT=$(ls knowledge/rules/*.json 2>/dev/null | grep -v _rules | wc -l)
echo "✅ Found $RULES_COUNT knowledge rule files"

echo ""
echo "🚀 Ready! Run these commands:"
echo "   npm run api    — Start backend (port 4000)"
echo "   npm run dev    — Start frontend (port 3000)"
echo ""
echo "📖 Read CLAUDE.md for project context"
echo "📋 Read docs/CURRENT_PHASE.md for current tasks"
