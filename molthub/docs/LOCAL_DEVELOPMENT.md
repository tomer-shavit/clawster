# Local Development Guide

This guide will help you set up Molthub for local development.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

### Required

- **Node.js** 20+ and npm 10+
  ```bash
  node --version  # Should be v20.x.x or higher
  npm --version   # Should be 10.x.x or higher
  ```

- **Docker** and **Docker Compose**
  ```bash
  docker --version        # Should be 24.x.x or higher
  docker-compose --version # Should be 2.x.x or higher
  ```

- **Git**
  ```bash
  git --version  # Should be 2.x.x or higher
  ```

### Optional (for non-Docker development)

- **PostgreSQL** 16+
- **Redis** 7+

## 🚀 Quick Setup

### Option 1: Docker Development (Recommended)

This is the fastest way to get started. All services run in Docker containers.

```bash
# 1. Clone the repository
git clone https://github.com/tomer-shavit/molthub.git
cd molthub

# 2. Copy environment variables
cp .env.example .env

# 3. Start all services
docker-compose up -d

# 4. Check service health
npm run health:check

# 5. Open the app
open http://localhost:3000
```

**Services started:**
- Web UI: http://localhost:3000
- API: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Option 2: Hybrid Development

Run database services in Docker, but develop the app locally.

```bash
# 1. Start only database services
docker-compose up -d postgres redis

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env to use localhost for database connections

# 4. Run database migrations
npm run db:migrate

# 5. Start development server
npm run dev
```

### Option 3: Full Local Development

Run everything locally without Docker.

```bash
# 1. Install dependencies
npm install

# 2. Set up PostgreSQL locally
# Create database: molthub_dev
# Create user: postgres/postgres

# 3. Set up Redis locally
# Default port: 6379

# 4. Configure environment
cp .env.example .env
# Edit .env with your local database settings

# 5. Run migrations
npm run db:migrate

# 6. Start development
npm run dev
```

## 📁 Project Structure

```
molthub/
├── packages/
│   ├── api/              # Backend API (Node.js/Express)
│   │   ├── src/
│   │   │   ├── index.ts      # Entry point
│   │   │   ├── routes/       # API routes
│   │   │   ├── services/     # Business logic
│   │   │   └── middleware/   # Express middleware
│   │   ├── prisma/
│   │   │   └── schema.prisma # Database schema
│   │   └── package.json
│   ├── web/              # Frontend (Next.js)
│   │   ├── src/
│   │   │   ├── app/          # Next.js app router
│   │   │   ├── components/   # React components
│   │   │   └── stores/       # Zustand stores
│   │   └── package.json
│   └── shared/           # Shared utilities and types
│       └── src/
├── infra/
│   └── terraform/        # Infrastructure as Code
├── scripts/              # Utility scripts
├── docker-compose.yml    # Local development
└── docker-compose.prod.yml # Production config
```

## 🔧 Development Workflow

### Starting Development

```bash
# Start all services (Docker)
docker-compose up -d

# Or start only databases
docker-compose up -d postgres redis

# View logs
docker-compose logs -f api
docker-compose logs -f web

# Stop services
docker-compose down
```

### Making Changes

**Backend (API):**
```bash
# API code is in packages/api/src/
# Changes are automatically reloaded via tsx watch

# View API logs
docker-compose logs -f api
```

**Frontend (Web):**
```bash
# Web code is in packages/web/src/
# Changes are automatically hot-reloaded by Next.js

# View web logs
docker-compose logs -f web
```

### Database Changes

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Create a new migration
npm run db:migrate:dev -- --name add_user_preferences

# Reset database (caution: destroys data)
cd packages/api && npx prisma migrate reset

# Open Prisma Studio (database GUI)
npm run db:studio
```

## 🧪 Running Tests

### All Tests

```bash
# Run tests for all packages
npm run test

# Run with coverage
npm run test -- --coverage
```

### Package-Specific Tests

```bash
# API tests
cd packages/api && npm run test

# Web tests
cd packages/web && npm run test

# Watch mode
cd packages/api && npm run test:watch
```

### Test Structure

```
packages/api/
├── src/
│   └── services/
│       └── provider.service.ts
└── tests/
    ├── unit/
    │   └── services/
    │       └── provider.service.test.ts
    ├── integration/
    │   └── routes/
    │       └── providers.test.ts
    └── fixtures/
        └── providers.ts
```

### Writing Tests

**Unit Test Example:**
```typescript
// packages/api/tests/unit/services/provider.service.test.ts
import { ProviderService } from '../../../src/services/provider.service';

describe('ProviderService', () => {
  let service: ProviderService;

  beforeEach(() => {
    service = new ProviderService();
  });

  describe('validateApiKey', () => {
    it('should return true for valid OpenAI key', async () => {
      const result = await service.validateApiKey('openai', 'sk-valid');
      expect(result).toBe(true);
    });

    it('should throw error for invalid key', async () => {
      await expect(
        service.validateApiKey('openai', 'invalid')
      ).rejects.toThrow('Invalid API key');
    });
  });
});
```

## 🔍 Debugging

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "localRoot": "${workspaceFolder}/packages/api",
      "remoteRoot": "/app/packages/api"
    },
    {
      "name": "Debug Web",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev", "--workspace=@molthub/web"],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

### Logging

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# View logs with filtering
docker-compose logs -f api | grep ERROR
```

## 🐛 Common Issues

### Port Already in Use

**Error:** `bind: address already in use`

**Solution:**
```bash
# Find process using port
lsof -i :3000
lsof -i :3001

# Kill process
kill -9 <PID>

# Or use different ports in .env
PORT=3002
```

### Database Connection Failed

**Error:** `Error: P1001: Can't reach database server`

**Solution:**
```bash
# Check if database is running
docker-compose ps postgres

# Restart database
docker-compose restart postgres

# Check logs
docker-compose logs postgres

# Verify connection string in .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/molthub_dev
```

### Migration Errors

**Error:** `P3005: The database schema is not empty`

**Solution:**
```bash
# Reset and re-run migrations
cd packages/api
npx prisma migrate reset

# Or mark as applied if already in sync
npx prisma migrate resolve --applied <migration_name>
```

### Node Modules Issues

**Error:** `Cannot find module` or `Module not found`

**Solution:**
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
rm -rf packages/*/node_modules
npm install

# If using Docker
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Redis Connection Issues

**Error:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution:**
```bash
# Check Redis status
docker-compose ps redis

# Test Redis connection
docker-compose exec redis redis-cli ping

# Should return: PONG
```

### Environment Variables Not Loading

**Error:** `undefined` for env vars

**Solution:**
```bash
# Ensure .env file exists
cp .env.example .env

# Check file is loaded
# For Docker: restart containers
docker-compose restart

# For local: restart dev server
```

## 🔐 Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/molthub_dev

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# API
API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# Logging
LOG_LEVEL=debug  # debug, info, warn, error
```

### Optional Variables

```bash
# External Services
SENTRY_DSN=          # Error tracking
POSTHOG_KEY=         # Analytics

# Feature Flags
ENABLE_MIGRATIONS=true
ENABLE_COST_ALERTS=true
```

## 📝 Code Style

### Linting

```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint -- --fix

# Check specific package
cd packages/api && npm run lint
```

### Formatting

```bash
# Format all files
npm run format

# Check formatting
npx prettier --check "**/*.{ts,tsx,md,json}"
```

### Pre-commit Hooks

```bash
# Install husky (if not already installed)
npx husky install

# Hooks will run automatically on commit
# - lint-staged (format and lint)
# - typecheck
```

## 🌐 Useful Commands

```bash
# Health check
npm run health:check

# Clean build artifacts
npm run clean

# Type check
npm run typecheck

# Rebuild Docker images
docker-compose build --no-cache

# View running containers
docker-compose ps

# Shell into container
docker-compose exec api sh
docker-compose exec postgres psql -U postgres

# Backup database
docker-compose exec postgres pg_dump -U postgres molthub_dev > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres molthub_dev < backup.sql
```

## 📚 Additional Resources

- [API Documentation](./API.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Express Documentation](https://expressjs.com/en/guide/routing.html)

## 🤝 Getting Help

If you encounter issues not covered here:

1. Check [GitHub Issues](https://github.com/tomer-shavit/molthub/issues)
2. Join our [Discord community](https://discord.gg/molthub)
3. Email: dev-support@molthub.ai

## 🎉 Success!

If you've reached this point, you should have a fully functional development environment. Happy coding!
