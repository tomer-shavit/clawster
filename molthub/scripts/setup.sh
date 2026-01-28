#!/bin/bash
set -e

# ==========================================
# Setup Script for Molthub Development
# ==========================================

echo "🚀 Setting up Molthub development environment..."

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 20+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup environment files
if [ ! -f ".env.development" ]; then
    echo "📝 Creating .env.development..."
    cat > .env.development << EOF
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/molthub_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-change-in-production
API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF
fi

if [ ! -f ".env.test" ]; then
    echo "📝 Creating .env.test..."
    cat > .env.test << EOF
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/molthub_test
REDIS_URL=redis://localhost:6379
JWT_SECRET=test-secret
API_BASE_URL=http://localhost:3001
EOF
fi

# Generate Prisma client
echo "📝 Generating Prisma client..."
cd packages/api && npx prisma generate && cd ../..

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d postgres redis

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Run migrations
echo "🗄️  Running database migrations..."
npm run db:migrate

# Build packages
echo "🔨 Building packages..."
npm run build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start development server: npm run dev"
echo "  2. Or use Docker: docker-compose up"
echo ""
