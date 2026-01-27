# Contributing to Molthub

Thank you for your interest in contributing to Molthub!

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Start PostgreSQL: `docker-compose up -d postgres`
4. Run migrations: `pnpm db:push`
5. Start development: `pnpm dev`

## Project Structure

- `apps/api` - NestJS API
- `apps/web` - Next.js web UI
- `packages/core` - Shared types and schemas
- `packages/database` - Prisma schema and client
- `packages/adapters-aws` - AWS integrations
- `packages/cli` - Molthub CLI

## Making Changes

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make your changes
3. Add tests if applicable
4. Run lint: `pnpm lint`
5. Commit with conventional commits: `feat: add new feature`
6. Push and create a PR

## Commit Convention

We use conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Tests
- `ci:` - CI/CD changes

## Code Style

- TypeScript strict mode
- ESLint for linting
- Prettier for formatting

## Testing

```bash
# Run all tests
pnpm test

# Test specific package
pnpm --filter @molthub/api test
```

## Questions?

Open an issue or discussion on GitHub.