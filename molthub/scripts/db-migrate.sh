#!/bin/bash
set -e

# ==========================================
# Database Migration Script
# ==========================================

COMMAND=${1:-status}
ENVIRONMENT=${2:-development}

echo "🗄️  Molthub Database Migration"
echo "   Command: $COMMAND"
echo "   Environment: $ENVIRONMENT"

# Load environment variables
if [ -f ".env.$ENVIRONMENT" ]; then
    echo "📄 Loading .env.$ENVIRONMENT"
    export $(grep -v '^#' .env.$ENVIRONMENT | xargs)
fi

# Ensure DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL is not set"
    exit 1
fi

# Navigate to API package
cd packages/api

case $COMMAND in
    status)
        echo "📊 Migration status:"
        npx prisma migrate status
        ;;
        
    migrate|deploy)
        echo "🚀 Deploying migrations..."
        npx prisma migrate deploy
        ;;
        
    dev)
        echo "🔧 Running development migration..."
        npx prisma migrate dev
        ;;
        
    reset)
        echo "⚠️  Resetting database..."
        read -p "Are you sure? This will delete all data! (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            npx prisma migrate reset --force
        else
            echo "❌ Cancelled"
        fi
        ;;
        
    seed)
        echo "🌱 Seeding database..."
        npx prisma db seed
        ;;
        
    generate)
        echo "📝 Generating Prisma client..."
        npx prisma generate
        ;;
        
    studio)
        echo "🎨 Opening Prisma Studio..."
        npx prisma studio
        ;;
        
    backup)
        echo "💾 Creating backup..."
        timestamp=$(date +%Y%m%d_%H%M%S)
        pg_dump $DATABASE_URL > "backup_$timestamp.sql"
        echo "✅ Backup created: backup_$timestamp.sql"
        ;;
        
    *)
        echo "Usage: $0 [status|migrate|dev|reset|seed|generate|studio|backup] [environment]"
        echo ""
        echo "Commands:"
        echo "  status    - Show migration status"
        echo "  migrate   - Deploy pending migrations (production)"
        echo "  dev       - Create and apply migrations (development)"
        echo "  reset     - Reset database (dangerous!)"
        echo "  seed      - Seed database with initial data"
        echo "  generate  - Generate Prisma client"
        echo "  studio    - Open Prisma Studio"
        echo "  backup    - Create database backup"
        exit 1
        ;;
esac

echo "✅ Done!"
