# Communication Channels

Configure and monitor messaging channels for your Moltbots. Each bot can have multiple communication channels (Slack, Telegram, Discord, Email, Webhook, etc.) with minimal setup.

## Overview

Communication Channels let you:
- **Configure once, use everywhere** — Create a Slack channel config, bind it to multiple bots
- **Purpose-based routing** — Send alerts to one channel, logs to another
- **Minimal configuration** — Just the API token for most channels
- **Health monitoring** — Built-in status checks and metrics
- **Bot-specific overrides** — Customize settings per bot while sharing the connection

## Supported Channel Types

| Type | Required Fields | Optional Fields |
|------|-----------------|-----------------|
| **Slack** | `token` | `channelId`, `channelName`, `iconEmoji`, `username` |
| **Telegram** | `botToken` | `chatId`, `parseMode` |
| **Discord** | `botToken` | `guildId`, `channelId`, `webhookUrl` |
| **Email (SMTP)** | `smtpHost`, `smtpPort`, `username`, `password`, `fromAddress` | `useTls`, `useSsl` |
| **Webhook** | `url` | `headers`, `secret`, `method`, `timeoutMs` |
| **SMS** | `provider`, `apiKey` | `fromNumber`, `apiSecret` |
| **Pushover** | `appToken`, `userKey` | `priority`, `sound` |
| **Custom** | — | `handlerUrl`, `headers`, `auth` |

## Quick Start

### 1. Create a Channel

```bash
# Create a Slack channel for alerts
curl -X POST http://localhost:3000/channels \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Alerts",
    "workspaceId": "ws_xxx",
    "type": "SLACK",
    "config": {
      "token": "xoxb-your-bot-token"
    },
    "defaults": {
      "mentionOnError": true,
      "quietHours": { "start": "22:00", "end": "08:00" }
    }
  }'
```

### 2. Bind to a Bot

```bash
# Bind the channel to bot-1 for error notifications
curl -X POST http://localhost:3000/channels/{channelId}/bind \
  -H "Content-Type: application/json" \
  -d '{
    "botId": "bot_xxx",
    "purpose": "error-alerts",
    "settings": {
      "filters": [{ "type": "error", "minSeverity": "high" }],
      "mentionUsers": ["@oncall"]
    },
    "targetDestination": {
      "channelId": "C123456"
    }
  }'
```

### 3. Test the Connection

```bash
# Test the channel connection
curl -X POST http://localhost:3000/channels/{channelId}/test

# Send a test message
curl -X POST http://localhost:3000/channels/{channelId}/test-message \
  -H "Content-Type: application/json" \
  -d '{ "message": "Hello from Molthub!" }'
```

## API Reference

### Channel Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/channels` | Create a new channel |
| `GET` | `/channels` | List channels (with filters) |
| `GET` | `/channels/types` | Get supported channel types |
| `GET` | `/channels/:id` | Get channel details with bindings |
| `PATCH` | `/channels/:id` | Update channel |
| `DELETE` | `/channels/:id` | Delete channel |
| `POST` | `/channels/:id/test` | Test connection |
| `POST` | `/channels/:id/test-message` | Send test message |

### Bot Bindings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/channels/:id/bind` | Bind channel to bot |
| `DELETE` | `/channels/:id/bind/:bindingId` | Remove binding |
| `PATCH` | `/channels/:id/bind/:bindingId` | Update binding settings |

### Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/channels/:id/stats` | Get channel metrics |
| `GET` | `/channels/:id/bots` | List bots using this channel |
| `GET` | `/channels/bot/:botId/channels` | Get bot's channels |
| `POST` | `/channels/bot/:botId/health-check` | Check all channels health |

## Configuration Examples

### Slack

```json
{
  "type": "SLACK",
  "config": {
    "token": "xoxb-your-bot-token",
    "channelId": "C123456789",
    "username": "Molthub Bot",
    "iconEmoji": ":robot_face:"
  }
}
```

### Telegram

```json
{
  "type": "TELEGRAM",
  "config": {
    "botToken": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    "chatId": "-1001234567890",
    "parseMode": "Markdown"
  }
}
```

### Discord

```json
{
  "type": "DISCORD",
  "config": {
    "botToken": "YOUR_BOT_TOKEN",
    "channelId": "123456789012345678",
    "webhookUrl": "https://discord.com/api/webhooks/..."
  }
}
```

### Email (SMTP)

```json
{
  "type": "EMAIL",
  "config": {
    "smtpHost": "smtp.gmail.com",
    "smtpPort": 587,
    "username": "alerts@example.com",
    "password": "app-specific-password",
    "fromAddress": "Molthub Alerts <alerts@example.com>",
    "useTls": true
  }
}
```

### Webhook

```json
{
  "type": "WEBHOOK",
  "config": {
    "url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer token"
    },
    "secret": "webhook-signing-secret"
  }
}
```

## Binding Settings

When binding a channel to a bot, you can customize:

```json
{
  "purpose": "error-alerts",
  "settings": {
    "filters": [
      { "type": "error", "minSeverity": "high" },
      { "type": "deployment", "status": "failed" }
    ],
    "formatting": "markdown",
    "mentionUsers": ["@oncall", "@sre-team"],
    "includeMetadata": true,
    "maxMessageLength": 2000
  },
  "targetDestination": {
    "channelId": "C123456",
    "threadTs": "1234567890.123456"
  }
}
```

### Purpose Values

Common purposes for organizing your channels:
- `notifications` — General notifications
- `error-alerts` — Error and exception alerts
- `deployment` — Deployment status updates
- `logs` — Log forwarding
- `user-messages` — User-facing messages
- `heartbeat` — Health check pings
- `audit` — Audit trail events

## Health Monitoring

Channels automatically track:

- **Status**: `ACTIVE`, `INACTIVE`, `ERROR`, `PENDING`, `DEGRADED`
- **Messages Sent/Failed**: Success rate metrics
- **Last Activity**: Timestamp of last message
- **Error Count**: Consecutive failures
- **Health Checks**: Per-binding health status

### Checking Health

```bash
# Check all channels for a bot
curl -X POST http://localhost:3000/channels/bot/{botId}/health-check
```

Response:
```json
{
  "botId": "bot_xxx",
  "total": 3,
  "healthy": 2,
  "unhealthy": 1,
  "channels": [
    {
      "bindingId": "bind_xxx",
      "channelId": "ch_xxx",
      "channelName": "Slack Alerts",
      "type": "SLACK",
      "purpose": "error-alerts",
      "healthy": true
    },
    {
      "bindingId": "bind_yyy",
      "channelId": "ch_yyy",
      "channelName": "Telegram Logs",
      "type": "TELEGRAM",
      "purpose": "logs",
      "healthy": false,
      "error": "Invalid bot token"
    }
  ]
}
```

## Channel Stats

```bash
curl http://localhost:3000/channels/{channelId}/stats
```

Response:
```json
{
  "channel": {
    "id": "ch_xxx",
    "name": "Slack Alerts",
    "type": "SLACK",
    "status": "ACTIVE"
  },
  "metrics": {
    "messagesSent": 1523,
    "messagesFailed": 12,
    "errorCount": 2,
    "successRate": 99.2
  },
  "bindings": {
    "total": 5,
    "recent": [...]
  },
  "health": {
    "lastTestedAt": "2026-01-28T10:30:00Z",
    "lastActivityAt": "2026-01-28T12:45:00Z",
    "lastError": null
  }
}
```

## Best Practices

### 1. Use Shared Channels

Create channels with `isShared: true` (default) and bind them to multiple bots:
- One "Production Alerts" channel → All production bots
- One "Dev Notifications" channel → All dev bots

### 2. Organize by Purpose

Use clear purpose names:
- `error-alerts` for critical errors
- `deployment` for deployment notifications
- `logs` for log aggregation

### 3. Filter by Severity

Use binding settings to filter what gets sent:
```json
{
  "settings": {
    "filters": [{ "type": "error", "minSeverity": "high" }]
  }
}
```

### 4. Test Before Binding

Always test the channel before binding to bots:
```bash
curl -X POST /channels/{id}/test
curl -X POST /channels/{id}/test-message -d '{"message":"Test"}'
```

### 5. Monitor Health

Set up periodic health checks:
```bash
# Run this periodically (e.g., every 5 minutes)
curl -X POST /channels/bot/{botId}/health-check
```

## Future Enhancements

Planned features:
- **Channel Templates** — Pre-configured templates for common setups
- **Message Batching** — Batch multiple messages to reduce noise
- **Rate Limiting** — Prevent spam with per-channel rate limits
- **Message Routing Rules** — Advanced filtering with regex/matching
- **Fallback Channels** — Auto-fallback if primary channel fails
- **Scheduled Messages** — Send messages at specific times
- **Rich Media** — Support for attachments, images, buttons

## Database Schema

See the migration at:
```
packages/database/prisma/migrations/20260128_add_communication_channels/
```

Key tables:
- `CommunicationChannel` — Channel configurations
- `BotChannelBinding` — Bot-to-channel bindings
