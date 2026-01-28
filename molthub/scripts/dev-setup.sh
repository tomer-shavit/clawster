#!/bin/bash
# =============================================================================
# Molthub Development Setup Script
# 
# This script sets up your local development environment for Molthub.
# It checks prerequisites, installs dependencies, sets up the database,
# and seeds sample data.
#
# Usage: ./scripts/dev-setup.sh [--docker-only]
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js version
check_node() {
    print_header "Checking Node.js"
    
    if ! command_exists node; then
        print_error "Node.js is not installed. Please install Node.js 20 or higher."
        print_info "Visit: https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'.' -f1)
    
    if [ "$NODE_MAJOR" -lt 20 ]; then
        print_error "Node.js 20+ is required. Current version: $NODE_VERSION"
        print_info "Please upgrade Node.js: https://nodejs.org/"
        exit 1
    fi
    
    print_success "Node.js version: $NODE_VERSION"
}

# Check npm version
check_npm() {
    print_header "Checking npm"
    
    if ! command_exists npm; then
        print_error "npm is not installed. It should come with Node.js."
        exit 1
    fi
    
    NPM_VERSION=$(npm -v)
    print_success "npm version: $NPM_VERSION"
}

# Check Docker
check_docker() {
    print_header "Checking Docker"
    
    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker."
        print_info "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    DOCKER_VERSION=$(docker --version)
    print_success "$DOCKER_VERSION"
    
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    
    print_success "Docker daemon is running"
}

# Check Docker Compose
check_docker_compose() {
    print_header "Checking Docker Compose"
    
    if command_exists docker-compose; then
        COMPOSE_VERSION=$(docker-compose --version)
        print_success "docker-compose: $COMPOSE_VERSION"
    elif docker compose version >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker compose version)
        print_success "docker compose (plugin): $COMPOSE_VERSION"
    else
        print_error "Docker Compose is not installed. Please install Docker Compose."
        print_info "Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi
}

# Copy environment file
setup_env() {
    print_header "Setting up Environment"
    
    if [ -f ".env" ]; then
        print_warning ".env file already exists. Skipping..."
        print_info "Review .env.example for any new variables you might need."
    else
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Created .env from .env.example"
            print_info "Please review and update .env with your actual values"
        else
            print_error ".env.example not found!"
            exit 1
        fi
    fi
    
    # Also create .env.development if it doesn't exist
    if [ ! -f ".env.development" ]; then
        cp .env .env.development 2>/dev/null || true
        print_success "Created .env.development"
    fi
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    print_info "Installing root dependencies..."
    npm install
    
    print_success "Dependencies installed"
}

# Start Docker services
start_docker_services() {
    print_header "Starting Docker Services"
    
    print_info "Starting PostgreSQL and Redis..."
    docker-compose up -d postgres redis
    
    print_info "Waiting for services to be healthy..."
    sleep 5
    
    # Wait for PostgreSQL
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ]; do
        if docker-compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
            print_success "PostgreSQL is ready"
            break
        fi
        attempts=$((attempts + 1))
        print_info "Waiting for PostgreSQL... ($attempts/$max_attempts)"
        sleep 2
    done
    
    if [ $attempts -eq $max_attempts ]; then
        print_error "PostgreSQL failed to start"
        exit 1
    fi
    
    # Wait for Redis
    attempts=0
    while [ $attempts -lt $max_attempts ]; do
        if docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
            print_success "Redis is ready"
            break
        fi
        attempts=$((attempts + 1))
        print_info "Waiting for Redis... ($attempts/$max_attempts)"
        sleep 2
    done
    
    if [ $attempts -eq $max_attempts ]; then
        print_error "Redis failed to start"
        exit 1
    fi
}

# Setup database
setup_database() {
    print_header "Setting up Database"
    
    # Check if prisma schema exists
    if [ -f "packages/api/prisma/schema.prisma" ]; then
        print_info "Generating Prisma client..."
        cd packages/api && npx prisma generate && cd ../..
        
        print_info "Running database migrations..."
        cd packages/api && npx prisma migrate dev --name init && cd ../..
        
        print_success "Database migrations completed"
    else
        print_warning "No Prisma schema found at packages/api/prisma/schema.prisma"
        print_info "Skipping database setup. You may need to set up the database manually."
    fi
}

# Seed sample data
seed_data() {
    print_header "Seeding Sample Data"
    
    # Check if seed script exists
    if [ -f "packages/api/prisma/seed.ts" ]; then
        print_info "Running database seed..."
        cd packages/api && npx tsx prisma/seed.ts && cd ../..
        print_success "Sample data seeded"
    else
        print_warning "No seed script found at packages/api/prisma/seed.ts"
        print_info "Creating sample seed data..."
        
        # Create a basic seed script if it doesn't exist
        mkdir -p packages/api/prisma
        cat > packages/api/prisma/seed.ts << 'EOF'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create a sample fleet
  const fleet = await prisma.fleet.upsert({
    where: { id: 'sample-fleet-001' },
    update: {},
    create: {
      id: 'sample-fleet-001',
      name: 'Sample Fleet',
      description: 'A sample fleet for testing',
      status: 'ACTIVE',
    },
  })
  console.log('✅ Created fleet:', fleet.name)

  // Create a sample bot template
  const template = await prisma.botTemplate.upsert({
    where: { id: 'sample-template-001' },
    update: {},
    create: {
      id: 'sample-template-001',
      name: 'Echo Bot',
      description: 'A simple bot that echoes messages',
      version: '1.0.0',
      config: {
        type: 'echo',
        settings: {
          prefix: 'Echo: ',
        },
      },
    },
  })
  console.log('✅ Created template:', template.name)

  // Create a sample bot
  const bot = await prisma.bot.upsert({
    where: { id: 'sample-bot-001' },
    update: {},
    create: {
      id: 'sample-bot-001',
      name: 'Sample Bot',
      description: 'A sample bot instance',
      fleetId: fleet.id,
      templateId: template.id,
      status: 'IDLE',
      config: {
        greeting: 'Hello from Sample Bot!',
      },
    },
  })
  console.log('✅ Created bot:', bot.name)

  console.log('✅ Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
EOF
        print_success "Created seed script at packages/api/prisma/seed.ts"
        print_info "To run the seed manually: cd packages/api && npx tsx prisma/seed.ts"
    fi
}

# Build packages
build_packages() {
    print_header "Building Packages"
    
    print_info "Building shared package..."
    npm run build --workspace=@molthub/shared 2>/dev/null || print_warning "Shared package build skipped (may not exist yet)"
    
    print_info "Building API package..."
    npm run build --workspace=@molthub/api 2>/dev/null || print_warning "API package build skipped (may not exist yet)"
    
    print_info "Building Web package..."
    npm run build --workspace=@molthub/web 2>/dev/null || print_warning "Web package build skipped (may not exist yet)"
    
    print_success "Build completed"
}

# Main function
main() {
    print_header "Molthub Development Setup"
    
    # Get script directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR/.."
    
    print_info "Working directory: $(pwd)"
    
    # Check prerequisites
    check_node
    check_npm
    check_docker
    check_docker_compose
    
    # Setup environment
    setup_env
    
    # Install dependencies
    install_dependencies
    
    # Start Docker services
    start_docker_services
    
    # Setup database
    setup_database
    
    # Seed sample data
    seed_data
    
    # Build packages
    build_packages
    
    # Final message
    print_header "Setup Complete! 🎉"
    echo ""
    echo -e "${GREEN}Your Molthub development environment is ready!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo ""
    echo "  1. ${YELLOW}Start all services with Docker:${NC}"
    echo "     docker-compose up"
    echo ""
    echo "  2. ${YELLOW}Or start services individually:${NC}"
    echo "     docker-compose up postgres redis  # Just the database"
    echo "     npm run dev                       # Start API and Web locally"
    echo ""
    echo "  3. ${YELLOW}Access the application:${NC}"
    echo "     Web UI:  http://localhost:3000"
    echo "     API:     http://localhost:3001"
    echo ""
    echo "  4. ${YELLOW}Useful commands:${NC}"
    echo "     docker-compose logs -f            # View logs"
    echo "     docker-compose down               # Stop services"
    echo "     npm run db:migrate                # Run migrations"
    echo "     npm run test                      # Run tests"
    echo ""
    echo -e "${BLUE}Happy coding! 🚀${NC}"
    echo ""
}

# Run main function
main "$@"
