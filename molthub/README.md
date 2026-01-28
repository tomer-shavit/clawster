# Molthub

AI Cost Control and Migration Platform

## Quick Start (5 Minutes)

Get a local Molthub instance running in just a few commands:

```bash
# Clone the repository
git clone https://github.com/tomer-shavit/molthub.git
cd molthub

# Run the development setup script
./scripts/dev-setup.sh

# Start all services
docker-compose up
```

That's it! Your Molthub instance is now running at:
- **Web UI**: http://localhost:3000
- **API**: http://localhost:3001

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **npm** 10+ (comes with Node.js)
- **Docker** 24+ ([Download](https://docs.docker.com/get-docker/))
- **Docker Compose** 2+ (usually included with Docker Desktop)

Verify your installation:
```bash
node --version  # Should be v20.x.x or higher
npm --version   # Should be 10.x.x or higher
docker --version
docker-compose --version  # or: docker compose version
```

## Development Setup

### Option 1: Docker Development (Recommended)

The easiest way to develop is using Docker Compose, which provides:
- PostgreSQL database with persistent storage
- Redis cache
- Hot-reload for API (NestJS/Express)
- Hot-reload for Web (Next.js)
- Automatic environment setup

```bash
# Run the setup script (only needed once)
./scripts/dev-setup.sh

# Start all services
docker-compose up

# Or run in detached mode
docker-compose up -d
```

Services will be available at:
- **Web UI**: http://localhost:3000
- **API**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

**View logs:**
```bash
docker-compose logs -f          # All services
docker-compose logs -f api      # API only
docker-compose logs -f web      # Web only
docker-compose logs -f postgres # Database only
```

**Stop services:**
```bash
docker-compose down             # Stop and remove containers
docker-compose down -v          # Stop and remove containers + volumes (⚠️ deletes data)
```

### Option 2: Local Development (Without Docker)

If you prefer to run services directly on your machine:

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env
# Edit .env and update DATABASE_URL and REDIS_URL for local connections

# 3. Start PostgreSQL and Redis (you need these installed locally)
# Or use Docker for just the infrastructure:
docker-compose up -d postgres redis

# 4. Run database migrations
cd packages/api && npx prisma migrate dev && cd ../..

# 5. Seed sample data
cd packages/api && npx tsx prisma/seed.ts && cd ../..

# 6. Build shared package
npm run build --workspace=@molthub/shared

# 7. Start development servers
npm run dev
```

This starts:
- API server with hot-reload on http://localhost:3001
- Web dev server with hot-reload on http://localhost:3000

### Option 3: Hybrid Development

Run the database in Docker and the application locally:

```bash
# Terminal 1: Start infrastructure
docker-compose up postgres redis

# Terminal 2: Run the application locally
npm install
npm run dev
```

## Environment Configuration

The application uses environment variables for configuration. See `.env.example` for all available options.

**Required variables:**
```bash
# Database (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/molthub_dev

# Cache (Redis)
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key-here

# API URLs
API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**To customize your environment:**
1. Copy `.env.example` to `.env`
2. Edit `.env` with your values
3. Restart the services

## Database Operations

### Migrations

```bash
# Create a new migration
cd packages/api && npx prisma migrate dev --name your_migration_name

# Run pending migrations
npm run db:migrate
# or: cd packages/api && npx prisma migrate deploy

# Reset database (⚠️ deletes all data)
cd packages/api && npx prisma migrate reset
```

### Seeding

```bash
# Run database seed
cd packages/api && npx tsx prisma/seed.ts
```

The seed script creates:
- 1 Sample Fleet
- 1 Bot Template (Echo Bot)
- 1 Bot Instance

### Database GUI

Prisma Studio provides a visual database editor:

```bash
cd packages/api && npx prisma studio
```

Access at: http://localhost:5556

## Project Structure

```
molthub/
├── docker-compose.yml          # Local development with Docker
├── docker-compose.prod.yml     # Production deployment
├── Dockerfile.api.dev          # API development Dockerfile
├── Dockerfile.web.dev          # Web development Dockerfile
├── Dockerfile.api              # API production Dockerfile
├── Dockerfile.web              # Web production Dockerfile
├── .env.example                # Environment variables template
├── scripts/
│   ├── dev-setup.sh            # Development setup script
│   ├── setup.sh                # Legacy setup script
│   ├── db-migrate.sh           # Database migration helper
│   ├── deploy.sh               # Deployment script
│   └── health-check.js         # Health check utility
├── packages/
│   ├── api/                    # Backend API (NestJS/Express)
│   │   ├── src/               # Source code
│   │   ├── prisma/            # Database schema and migrations
│   │   └── package.json
│   ├── web/                    # Frontend (Next.js)
│   │   ├── src/               # Source code
│   │   ├── public/            # Static assets
│   │   └── package.json
│   └── shared/                 # Shared utilities and types
│       ├── src/
│       └── package.json
├── turbo.json                  # Turborepo configuration
└── package.json               # Root package configuration
```

## Available Scripts

### Root Level

| Script | Description |
|--------|-------------|
| `npm run dev` | Start all packages in development mode |
| `npm run build` | Build all packages |
| `npm run test` | Run all tests |
| `npm run lint` | Run ESLint on all packages |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run clean` | Clean all build artifacts |
| `npm run format` | Format code with Prettier |
| `npm run db:migrate` | Run database migrations |
| `npm run db:generate` | Generate Prisma client |

### Docker Scripts

| Script | Description |
|--------|-------------|
| `npm run docker:up` | Start Docker containers |
| `npm run docker:down` | Stop Docker containers |
| `npm run docker:build` | Build Docker images |
| `npm run docker:prod:up` | Start production Docker containers |

### Development Scripts

```bash
# Start development setup
./scripts/dev-setup.sh

# Run database migrations
./scripts/db-migrate.sh

# Deploy to environment
./scripts/deploy.sh [staging|production]

# Check service health
npm run health:check
```

## Troubleshooting

### Port Already in Use

If you see errors like "port already in use":

```bash
# Find what's using the port
lsof -i :3000  # or :3001, :5432, :6379

# Stop all Docker containers
docker-compose down

# Or use different ports in .env:
WEB_PORT=3002
API_PORT=3002
POSTGRES_PORT=5433
REDIS_PORT=6380
```

### Database Connection Issues

```bash
# Reset Docker volumes (⚠️ deletes all data)
docker-compose down -v
docker-compose up -d postgres redis

# Or run the setup script again
./scripts/dev-setup.sh
```

### Hot Reload Not Working

If code changes don't trigger reloads:

```bash
# Restart the specific service
docker-compose restart api
docker-compose restart web

# Or rebuild and restart
docker-compose up --build api
```

### Permission Denied (Linux/Mac)

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Fix node_modules ownership
sudo chown -R $(whoami) node_modules
sudo chown -R $(whoami) packages/*/node_modules
```

## Deployment

### Environments

- **Staging**: `staging.molthub.ai`
- **Production**: `molthub.ai`

### Deploying

```bash
# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production
./scripts/deploy.sh production
```

## Infrastructure

Infrastructure is managed with Terraform:

```bash
cd infra/terraform

# Plan changes
terraform plan -var-file=staging.tfvars

# Apply changes
terraform apply -var-file=staging.tfvars
```

## CI/CD

GitHub Actions workflows:

- **CI** (`.github/workflows/ci.yml`): Run tests on PRs
- **Build** (`.github/workflows/build.yml`): Build all packages
- **Release** (`.github/workflows/release.yml`): Automated releases
- **Docker** (`.github/workflows/docker.yml`): Docker image builds

## Contributing

1. Create a new branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Run tests: `npm test`
4. Commit your changes: `git commit -am 'Add new feature'`
5. Push to the branch: `git push origin feature/your-feature`
6. Create a Pull Request

## License

MIT

## Support

For questions or support:
- Open an issue on GitHub
- Contact: tomer@molthub.ai
