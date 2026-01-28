# Contributing to Molthub

Thank you for your interest in contributing to Molthub! We welcome contributions from the community and are excited to work with you.

## 🤝 Ways to Contribute

- 🐛 **Report bugs** - Open an issue with detailed reproduction steps
- 💡 **Suggest features** - Share your ideas for improvements
- 📝 **Improve documentation** - Fix typos, clarify explanations, add examples
- 🔧 **Submit code** - Fix bugs or implement new features
- 🧪 **Add tests** - Improve test coverage
- 🎨 **Design** - Help improve UI/UX

## 📋 Development Workflow

### 1. Fork and Clone

```bash
# Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/molthub.git
cd molthub

# Add upstream remote
git remote add upstream https://github.com/tomer-shavit/molthub.git
```

### 2. Create a Branch

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Or a bugfix branch
git checkout -b fix/bug-description
```

**Branch naming conventions:**
- `feature/` - New features or enhancements
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or improvements
- `chore/` - Maintenance tasks

### 3. Set Up Development Environment

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start services
docker-compose up -d

# Run tests to ensure everything works
npm run test
```

See [Local Development Guide](./docs/LOCAL_DEVELOPMENT.md) for detailed setup instructions.

### 4. Make Changes

- Write clean, maintainable code
- Follow existing code style and patterns
- Add or update tests as needed
- Update documentation for any changed functionality

### 5. Commit Your Changes

We follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

```bash
git add .
git commit -m "feat: add provider health check endpoint"
```

### 6. Push and Create PR

```bash
# Push to your fork
git push origin feature/your-feature-name

# Create a Pull Request on GitHub
```

## 💬 Commit Message Conventions

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, semicolons, etc) |
| `refactor` | Code refactoring |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `chore` | Build process, dependencies, etc |
| `ci` | CI/CD changes |
| `revert` | Reverting changes |

### Scopes

Common scopes for this project:
- `api` - Backend API changes
- `web` - Frontend web changes
- `shared` - Shared package changes
- `db` - Database/schema changes
- `auth` - Authentication changes
- `provider` - AI provider integration
- `migration` - Migration functionality
- `costs` - Cost tracking features
- `infra` - Infrastructure/Terraform
- `docs` - Documentation

### Examples

```bash
# Feature with description
feat(api): add support for Anthropic provider

This adds a new provider adapter for Anthropic Claude API,
including model mapping and cost tracking.

Closes #123

# Bug fix
fix(web): resolve dashboard loading state issue

Fixed a race condition where the dashboard would show
infinite loading spinner when providers list was empty.

Fixes #456

# Documentation
docs: update API authentication guide

Added examples for JWT token refresh flow.

# Breaking change
feat(api)!: redesign cost tracking endpoints

BREAKING CHANGE: Cost endpoints now return paginated results
instead of full list. Update your integrations accordingly.
```

## 🧪 Testing Requirements

### Test Coverage

- All new features must include tests
- Bug fixes should include a test that reproduces the bug
- Aim for >80% code coverage

### Running Tests

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test -- --coverage

# Run tests for specific package
cd packages/api && npm run test
cd packages/web && npm run test

# Run tests in watch mode
cd packages/api && npm run test:watch
```

### Writing Tests

**Unit Test Example:**
```typescript
// packages/api/tests/unit/services/cost.service.test.ts
import { CostService } from '../../../src/services/cost.service';

describe('CostService', () => {
  describe('calculateDailyCosts', () => {
    it('should aggregate costs by provider', async () => {
      // Arrange
      const mockCosts = [
        { providerId: 'prov_1', amount: 100 },
        { providerId: 'prov_2', amount: 200 },
      ];
      
      // Act
      const result = await costService.calculateDailyCosts('2024-01-01');
      
      // Assert
      expect(result.total).toBe(300);
      expect(result.byProvider['prov_1']).toBe(100);
    });
  });
});
```

**Integration Test Example:**
```typescript
// packages/api/tests/integration/routes/providers.test.ts
describe('Providers API', () => {
  describe('POST /api/v1/providers', () => {
    it('should create a new provider', async () => {
      const response = await request(app)
        .post('/api/v1/providers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Provider',
          type: 'openai',
          apiKey: 'sk-test'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Test Provider');
    });
  });
});
```

## 🔍 PR Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] New tests added for new functionality
- [ ] Documentation updated
- [ ] Commit messages follow conventions
- [ ] Branch is up to date with main

### PR Template

When creating a PR, please include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings

## Screenshots (if applicable)
Add screenshots for UI changes

## Related Issues
Fixes #123
Closes #456
```

### Review Process

1. **Automated checks** must pass:
   - CI tests
   - Linting
   - Type checking
   - Security scanning

2. **Code review** by maintainers:
   - At least one approval required
   - Address review comments
   - Resolve conflicts if any

3. **Merge**:
   - Squash and merge by maintainer
   - Delete branch after merge

### Review Criteria

Maintainers will check for:

- **Correctness** - Does it solve the problem?
- **Tests** - Are there adequate tests?
- **Documentation** - Is it well-documented?
- **Performance** - Any performance concerns?
- **Security** - Any security implications?
- **Maintainability** - Is the code clean and readable?

## 🎨 Code Style

### TypeScript/JavaScript

- Use TypeScript for all new code
- Enable strict mode
- Use explicit types, avoid `any`
- Prefer `const` over `let`
- Use async/await over promises

### React/Next.js

- Use functional components with hooks
- Follow React best practices
- Use TypeScript for props
- Keep components small and focused

### API Code

- Follow RESTful principles
- Use proper HTTP status codes
- Validate all inputs with Zod
- Handle errors gracefully

### Example

```typescript
// Good
interface CreateProviderRequest {
  name: string;
  type: ProviderType;
  apiKey: string;
}

export async function createProvider(
  req: CreateProviderRequest
): Promise<Provider> {
  const validated = createProviderSchema.parse(req);
  
  const provider = await prisma.provider.create({
    data: validated
  });
  
  return provider;
}

// Avoid
function createProvider(data: any) {
  return prisma.provider.create({ data });
}
```

## 📚 Documentation

### Code Documentation

- Use JSDoc for public APIs
- Comment complex logic
- Keep comments up to date

```typescript
/**
 * Calculates the estimated cost for a given provider and usage.
 * 
 * @param providerId - The provider ID
 * @param tokensIn - Number of input tokens
 * @param tokensOut - Number of output tokens
 * @param model - The model name
 * @returns Estimated cost in USD
 * @throws ProviderNotFoundError if provider doesn't exist
 */
export async function estimateCost(
  providerId: string,
  tokensIn: number,
  tokensOut: number,
  model: string
): Promise<number> {
  // Implementation
}
```

### Documentation Files

- Update README.md if adding major features
- Update API.md for endpoint changes
- Update LOCAL_DEVELOPMENT.md for setup changes

## 🐛 Reporting Bugs

### Before Reporting

- Search existing issues first
- Check if it's already fixed in main
- Try to reproduce in latest version

### Bug Report Template

```markdown
**Description**
Clear description of the bug

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What you expected to happen

**Actual Behavior**
What actually happened

**Screenshots**
If applicable

**Environment**
- OS: [e.g. macOS 14.2]
- Browser: [e.g. Chrome 120]
- Node version: [e.g. 20.10.0]
- Molthub version: [e.g. 0.1.0]

**Additional Context**
Any other relevant information
```

## 💡 Feature Requests

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is

**Describe the solution you'd like**
What you want to happen

**Describe alternatives you've considered**
Other solutions you've thought about

**Additional context**
Any other context or screenshots
```

## 🏆 Recognition

Contributors will be:
- Listed in our README.md
- Mentioned in release notes
- Added to our contributors page

## 📞 Getting Help

- 💬 [Discord](https://discord.gg/molthub)
- 📧 Email: contributing@molthub.ai
- 🐛 [GitHub Issues](https://github.com/tomer-shavit/molthub/issues)

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Molthub! 🚀
