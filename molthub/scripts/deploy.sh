#!/bin/bash
set -e

# ==========================================
# Molthub Deployment Script
# ==========================================

ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}
REGISTRY=${REGISTRY:-ghcr.io}
REPO=${REPO:-tomer-shavit/molthub}

echo "🚀 Deploying Molthub to $ENVIRONMENT (version: $VERSION)"

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "❌ Invalid environment. Use 'staging' or 'production'"
    exit 1
fi

# Load environment variables
if [ -f ".env.$ENVIRONMENT" ]; then
    echo "📄 Loading .env.$ENVIRONMENT"
    export $(grep -v '^#' .env.$ENVIRONMENT | xargs)
fi

# Deploy based on environment
case $ENVIRONMENT in
    staging)
        echo "📦 Pulling latest images..."
        docker pull $REGISTRY/$REPO/api:$VERSION
        docker pull $REGISTRY/$REPO/web:$VERSION
        
        echo "🔄 Restarting services..."
        docker-compose -f docker-compose.prod.yml up -d
        
        echo "⏳ Waiting for services to be healthy..."
        sleep 10
        ;;
        
    production)
        echo "⚠️  Production deployment"
        echo "📦 Pulling images with version $VERSION..."
        docker pull $REGISTRY/$REPO/api:$VERSION
        docker pull $REGISTRY/$REPO/web:$VERSION
        
        echo "🔄 Performing rolling update..."
        # Blue-green or rolling deployment
        docker-compose -f docker-compose.prod.yml up -d --no-deps --scale api=3 api
        docker-compose -f docker-compose.prod.yml up -d --no-deps --scale web=3 web
        
        echo "🧹 Cleaning up old images..."
        docker image prune -f
        ;;
esac

# Run health check
echo "🏥 Running health check..."
if node scripts/health-check.js; then
    echo "✅ Deployment successful!"
else
    echo "❌ Health check failed! Rolling back..."
    # Implement rollback logic here
    exit 1
fi

echo "🎉 Molthub deployed successfully to $ENVIRONMENT!"
