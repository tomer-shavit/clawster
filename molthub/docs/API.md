# Molthub API Documentation

Welcome to the Molthub API documentation. This API provides programmatic access to manage AI providers, instances, costs, and migrations.

**Base URL:** `https://api.molthub.ai/v1`  
**Local:** `http://localhost:3001/api/v1`

---

## 🔐 Authentication

All API requests require authentication using a Bearer token.

### Obtaining an API Token

```bash
# Login to get a JWT token
curl -X POST https://api.molthub.ai/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2024-01-28T12:00:00Z",
  "user": {
    "id": "usr_123",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

### Using the Token

Include the token in the Authorization header for all requests:

```bash
curl https://api.molthub.ai/v1/providers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Token Refresh

```bash
curl -X POST https://api.molthub.ai/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'
```

---

## 📚 Endpoints

### Authentication

#### POST /auth/login
Authenticate a user and receive tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password"
}
```

**Response:**
```json
{
  "token": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "expiresAt": "2024-01-28T12:00:00Z"
}
```

#### POST /auth/register
Register a new user account.

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "secure-password",
  "name": "John Doe",
  "organization": "Acme Inc"
}
```

**Response:**
```json
{
  "id": "usr_456",
  "email": "newuser@example.com",
  "name": "John Doe",
  "createdAt": "2024-01-28T10:30:00Z"
}
```

---

### Providers

AI providers represent external AI services (OpenAI, Anthropic, etc.).

#### GET /providers
List all configured providers.

**Query Parameters:**
- `type` (optional): Filter by provider type (openai, anthropic, azure, etc.)
- `status` (optional): Filter by status (active, inactive, error)
- `limit` (optional): Number of results (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "data": [
    {
      "id": "prov_123",
      "name": "OpenAI Production",
      "type": "openai",
      "status": "active",
      "organizationId": "org-abc123",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-28T08:30:00Z",
      "metadata": {
        "models": ["gpt-4", "gpt-3.5-turbo"],
        "region": "us-east-1"
      }
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

#### POST /providers
Create a new provider connection.

**Request:**
```json
{
  "name": "Anthropic Claude",
  "type": "anthropic",
  "apiKey": "sk-ant-...",
  "organizationId": "org-def456",
  "metadata": {
    "models": ["claude-3-opus", "claude-3-sonnet"],
    "defaultModel": "claude-3-opus"
  }
}
```

**Response:**
```json
{
  "id": "prov_789",
  "name": "Anthropic Claude",
  "type": "anthropic",
  "status": "active",
  "createdAt": "2024-01-28T10:30:00Z",
  "apiKeyMasked": "sk-ant-****...last4"
}
```

#### GET /providers/:id
Get a single provider by ID.

**Response:**
```json
{
  "id": "prov_123",
  "name": "OpenAI Production",
  "type": "openai",
  "status": "active",
  "organizationId": "org-abc123",
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-28T08:30:00Z",
  "metadata": {
    "models": ["gpt-4", "gpt-3.5-turbo"],
    "region": "us-east-1"
  },
  "costs": {
    "today": 45.23,
    "thisMonth": 1234.56,
    "currency": "USD"
  }
}
```

#### PATCH /providers/:id
Update a provider configuration.

**Request:**
```json
{
  "name": "OpenAI Production - Updated",
  "apiKey": "sk-new-key...",
  "metadata": {
    "defaultModel": "gpt-4-turbo"
  }
}
```

#### DELETE /providers/:id
Delete a provider and all associated instances.

**Response:**
```json
{
  "success": true,
  "deletedAt": "2024-01-28T11:00:00Z"
}
```

#### POST /providers/:id/test
Test the provider connection.

**Response:**
```json
{
  "success": true,
  "latency": 234,
  "models": ["gpt-4", "gpt-3.5-turbo", "gpt-4-turbo-preview"]
}
```

---

### Instances

Instances represent deployed AI workloads running on providers.

#### GET /instances
List all instances.

**Query Parameters:**
- `providerId` (optional): Filter by provider
- `status` (optional): Filter by status (running, stopped, error, migrating)
- `limit`, `offset` (optional): Pagination

**Response:**
```json
{
  "data": [
    {
      "id": "inst_456",
      "name": "Customer Support Bot",
      "providerId": "prov_123",
      "providerName": "OpenAI Production",
      "model": "gpt-4",
      "status": "running",
      "createdAt": "2024-01-20T14:00:00Z",
      "lastUsedAt": "2024-01-28T09:45:00Z",
      "metrics": {
        "requestsToday": 15420,
        "tokensIn": 450000,
        "tokensOut": 890000,
        "averageLatency": 450
      }
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

#### POST /instances
Create a new AI instance.

**Request:**
```json
{
  "name": "Marketing Copy Generator",
  "providerId": "prov_123",
  "model": "gpt-4",
  "config": {
    "temperature": 0.7,
    "maxTokens": 2000,
    "systemPrompt": "You are a marketing expert..."
  },
  "rateLimits": {
    "requestsPerMinute": 100,
    "tokensPerDay": 1000000
  }
}
```

#### GET /instances/:id
Get instance details.

#### PATCH /instances/:id
Update instance configuration.

#### DELETE /instances/:id
Delete an instance.

#### POST /instances/:id/start
Start a stopped instance.

#### POST /instances/:id/stop
Stop a running instance.

#### GET /instances/:id/logs
Get instance logs.

---

### Costs

Cost tracking and analytics endpoints.

#### GET /costs/summary
Get overall cost summary.

**Query Parameters:**
- `period` (optional): today, week, month, year (default: month)
- `startDate`, `endDate` (optional): Custom date range

**Response:**
```json
{
  "period": "month",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "total": 5234.56,
  "currency": "USD",
  "breakdown": {
    "openai": 3210.45,
    "anthropic": 1523.67,
    "azure": 500.44
  },
  "trend": {
    "current": 5234.56,
    "previous": 4890.12,
    "change": 7.04,
    "changeType": "increase"
  }
}
```

#### GET /costs/by-provider
Get costs grouped by provider.

#### GET /costs/by-instance
Get costs grouped by instance.

#### GET /costs/by-model
Get costs grouped by model.

#### GET /costs/forecast
Get cost forecast for next period.

**Response:**
```json
{
  "forecast": {
    "predictedAmount": 5600.00,
    "confidence": 0.85,
    "trend": "upward",
    "factors": [
      "Increased usage in customer-support-bot",
      "New instance deployed: marketing-copy-gen"
    ]
  }
}
```

---

### Migrations

Migrate workloads between providers.

#### GET /migrations
List all migrations.

#### POST /migrations
Create a new migration plan.

**Request:**
```json
{
  "name": "OpenAI to Anthropic Migration",
  "sourceProviderId": "prov_123",
  "targetProviderId": "prov_789",
  "instances": ["inst_456", "inst_789"],
  "strategy": "zero-downtime",
  "mapping": {
    "modelMapping": {
      "gpt-4": "claude-3-opus",
      "gpt-3.5-turbo": "claude-3-sonnet"
    }
  },
  "schedule": {
    "startAt": "2024-02-01T02:00:00Z",
    "batchSize": 10
  }
}
```

**Response:**
```json
{
  "id": "mig_abc123",
  "name": "OpenAI to Anthropic Migration",
  "status": "scheduled",
  "progress": {
    "total": 2,
    "completed": 0,
    "failed": 0,
    "pending": 2
  },
  "estimatedDuration": "30 minutes",
  "createdAt": "2024-01-28T10:00:00Z"
}
```

#### GET /migrations/:id
Get migration status.

**Response:**
```json
{
  "id": "mig_abc123",
  "name": "OpenAI to Anthropic Migration",
  "status": "in_progress",
  "progress": {
    "total": 2,
    "completed": 1,
    "failed": 0,
    "pending": 1
  },
  "instances": [
    {
      "id": "inst_456",
      "name": "Customer Support Bot",
      "status": "completed",
      "migratedAt": "2024-01-28T10:15:00Z",
      "duration": 234000
    }
  ],
  "logs": [
    {
      "timestamp": "2024-01-28T10:15:00Z",
      "level": "info",
      "message": "Successfully migrated inst_456"
    }
  ]
}
```

#### POST /migrations/:id/execute
Execute a scheduled migration.

#### POST /migrations/:id/cancel
Cancel a pending or running migration.

#### POST /migrations/:id/rollback
Rollback a completed migration.

---

### Webhooks

Manage webhook subscriptions for events.

#### GET /webhooks
List webhooks.

#### POST /webhooks
Create a webhook.

**Request:**
```json
{
  "url": "https://your-app.com/webhooks/molthub",
  "events": ["instance.created", "cost.threshold.exceeded"],
  "secret": "your-webhook-secret",
  "active": true
}
```

---

## ❌ Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions for this action |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `PROVIDER_ERROR` | 502 | AI provider returned an error |
| `MIGRATION_FAILED` | 500 | Migration operation failed |
| `INSUFFICIENT_QUOTA` | 402 | Provider quota exceeded |

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "apiKey",
        "message": "API key is required"
      }
    ],
    "requestId": "req_abc123xyz"
  }
}
```

### Common Errors

#### Authentication Failed
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token",
    "requestId": "req_def456"
  }
}
```

#### Provider Connection Error
```json
{
  "error": {
    "code": "PROVIDER_ERROR",
    "message": "Failed to connect to OpenAI",
    "details": {
      "provider": "openai",
      "originalError": "Invalid API key"
    },
    "requestId": "req_ghi789"
  }
}
```

#### Rate Limiting
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "retryAfter": 60,
    "requestId": "req_jkl012"
  }
}
```

---

## 📊 Rate Limits

| Endpoint | Limit |
|----------|-------|
| All endpoints | 1000 requests/minute |
| Auth endpoints | 10 requests/minute |
| Provider test | 5 requests/minute |
| Migration execute | 1 per migration |

---

## 🔗 SDKs

Official SDKs coming soon:

- JavaScript/TypeScript: `npm install @molthub/sdk`
- Python: `pip install molthub`
- Go: `go get github.com/molthub/molthub-go`

---

## 💬 Support

- 📧 Email: api-support@molthub.ai
- 💬 Discord: [Join our community](https://discord.gg/molthub)
- 🐛 Issues: [GitHub Issues](https://github.com/tomer-shavit/molthub/issues)
