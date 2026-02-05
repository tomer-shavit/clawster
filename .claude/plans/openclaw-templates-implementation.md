# OpenClaw Templates Implementation Plan

## Overview

This document outlines the architecture for implementing **Persona Templates** in Clawster — full-featured templates that bundle identity, personality, skills, cron jobs, and configuration for OpenClaw bots.

**Goal**: Allow users to select a template (e.g., "Marketer") in the wizard before deployment, and have Clawster inject the complete persona into the OpenClaw instance after provisioning.

**Community Goal**: Architecture supports community-contributed templates via GitHub repos or a future template registry.

---

## OpenClaw References

### Source Code (GitHub)
| Component | Path | Description |
|-----------|------|-------------|
| Identity Parser | [`src/agents/identity-file.ts`](https://github.com/openclaw/openclaw/blob/main/src/agents/identity-file.ts) | `parseIdentityMarkdown()`, `loadIdentityFromFile()` |
| Skills Types | [`src/config/types.skills.ts`](https://github.com/openclaw/openclaw/blob/main/src/config/types.skills.ts) | Skill config schema, entries, env vars |
| Skills Loader | [`src/skills/loader.ts`](https://github.com/openclaw/openclaw/blob/main/src/skills/loader.ts) | `loadWorkspaceSkillEntries()`, skill resolution |
| Cron Types | [`src/cron/types.ts`](https://github.com/openclaw/openclaw/blob/main/src/cron/types.ts) | `CronJob`, `CronSchedule` interfaces |
| Cron Operations | [`src/cron/service/ops.ts`](https://github.com/openclaw/openclaw/blob/main/src/cron/service/ops.ts) | `add()`, `list()`, `update()`, `remove()`, `run()` |
| Config Schema | [`src/config/schema.ts`](https://github.com/openclaw/openclaw/blob/main/src/config/schema.ts) | Full `openclaw.json` validation |
| Agents Config | [`src/config/types.agents.ts`](https://github.com/openclaw/openclaw/blob/main/src/config/types.agents.ts) | `AgentConfig`, `agents.defaults`, `agents.list` |
| Gateway Protocol | [`src/gateway/protocol/schema/`](https://github.com/openclaw/openclaw/tree/main/src/gateway/protocol/schema) | RPC message schemas (TypeBox) |
| Workspace Templates | [`docs/reference/templates/`](https://github.com/openclaw/openclaw/tree/main/docs/reference/templates) | `AGENTS.md`, `SOUL.md`, `IDENTITY.md` templates |

### Documentation (docs.openclaw.ai)
| Topic | URL | Key Info |
|-------|-----|----------|
| Configuration Reference | [/gateway/configuration](https://docs.openclaw.ai/gateway/configuration) | Full JSON5 schema for `openclaw.json` |
| Skills System | [/tools/skills](https://docs.openclaw.ai/tools/skills) | YAML format, loading precedence, gating |
| Skills Config | [/tools/skills-config](https://docs.openclaw.ai/tools/skills-config) | `allowBundled`, `entries`, per-skill env/apiKey |
| Cron Jobs | [/automation/cron-jobs](https://docs.openclaw.ai/automation/cron-jobs) | Schedule types, execution modes, delivery |
| Workspace Templates | [/reference/templates/AGENTS](https://docs.openclaw.ai/reference/templates/AGENTS) | Agent operational guidelines template |
| Gateway Security | [/gateway/security](https://docs.openclaw.ai/gateway/security) | Auth, DM policies, sandbox, credentials |
| Multi-Agent | [/concepts/multi-agent](https://docs.openclaw.ai/concepts/multi-agent) | `agents.list`, bindings, routing |

### CLI Commands
```bash
# Skills
openclaw skills list --bundled          # List bundled skills
openclaw skills list                    # List all available skills
clawhub search "<query>"                # Search ClawHub registry
clawhub install <skill-slug>            # Install from ClawHub

# Cron
openclaw cron add [options]             # Create cron job
openclaw cron list                      # List jobs
openclaw cron run <jobId> --force       # Trigger immediately
openclaw cron edit <jobId> [patches]    # Update job

# Config
openclaw config get                     # Current config + hash
openclaw config apply <file>            # Apply new config
```

### ClawHub Skills Registry

**Registry URL**: [https://clawhub.com](https://clawhub.com)

**Key Skills for Templates**:
| Skill Slug | Description | Required Secrets |
|------------|-------------|------------------|
| `github` | GitHub integration (PRs, issues, repos) | `GITHUB_TOKEN` |
| `jira` | Jira ticket management | `JIRA_API_TOKEN`, `JIRA_EMAIL` |
| `search` | Web search capabilities | None (bundled) |
| `web-browse` | Browse and extract web content | None (bundled) |
| `social-media` | Buffer/Hootsuite posting | `BUFFER_API_KEY` |
| `analytics` | Google Analytics integration | `GA_API_KEY` |
| `calendar` | Google Calendar access | `GOOGLE_CALENDAR_CREDS` |
| `email` | Gmail send/read | `GMAIL_CREDS` |
| `slack-tools` | Slack channel management | `SLACK_BOT_TOKEN` |
| `image-gen` | AI image generation | `OPENAI_API_KEY` |
| `code-review` | Code analysis and review | None |
| `deployment` | CI/CD and deployment tools | Varies |

**Skill Installation Flow**:
```bash
# 1. Search for skill
clawhub search "social media"

# 2. View skill details
clawhub info social-media

# 3. Install to ~/.openclaw/skills/
clawhub install social-media

# 4. Configure in openclaw.json
{
  "skills": {
    "entries": {
      "social-media": {
        "enabled": true,
        "env": { "BUFFER_API_KEY": "${secret:bufferApiKey}" }
      }
    }
  }
}

# 5. Sync all installed skills
clawhub sync --all
```

**Skill Structure** (from ClawHub):
```
~/.openclaw/skills/<skill-name>/
├── SKILL.md              # YAML frontmatter + instructions
├── tools/                # Custom MCP tools (optional)
│   └── <tool-name>.ts
├── prompts/              # Prompt templates (optional)
└── package.json          # Dependencies (optional)
```

**SKILL.md Format**:
```markdown
---
name: social-media
description: Schedule and manage social media posts
version: 1.2.0
author: clawhub
user-invocable: true
requires:
  env: [BUFFER_API_KEY]
  bins: [curl]
metadata:
  openclaw:
    skillKey: social-media
    category: marketing
---

# Social Media Skill

This skill helps you schedule posts across platforms.

## Commands
- `/schedule` - Schedule a new post
- `/analytics` - View engagement metrics
- `/drafts` - Manage draft posts
```

---

## Table of Contents

1. [OpenClaw Template Components](#1-openclaw-template-components)
2. [Persona Template Schema](#2-persona-template-schema)
3. [Secret Resolution Architecture](#3-secret-resolution-architecture)
4. [Template Injection Flow](#4-template-injection-flow)
5. [Service Architecture (SOLID)](#5-service-architecture-solid)
6. [Database Schema Changes](#6-database-schema-changes)
7. [API Endpoints](#7-api-endpoints)
8. [Community Template Distribution](#8-community-template-distribution)
9. [Implementation Phases](#9-implementation-phases)

---

## 1. OpenClaw Template Components

OpenClaw uses **workspace files** to define agent behavior. A complete persona requires:

### 1.1 Identity (`IDENTITY.md`)

> **OpenClaw Source**: [`src/agents/identity-file.ts`](https://github.com/openclaw/openclaw/blob/main/src/agents/identity-file.ts)
> **Template Reference**: [`docs/reference/templates/IDENTITY.md`](https://github.com/openclaw/openclaw/blob/main/docs/reference/templates/IDENTITY.md)

**Location**: `<workspace>/IDENTITY.md`

**Format**: Markdown with key-value pairs
```markdown
- Name: Marketing Maven
- Emoji: 📈
- Creature: fox
- Vibe: energetic
- Theme: bright
- Avatar: https://example.com/avatar.png
```

**Loading**: Gateway parses at startup via `parseIdentityMarkdown()`. Resolution order: `agents.defaults.identity` config → `IDENTITY.md` → defaults.

**Key Implementation Details** (from OpenClaw source):
- Parser splits content by lines, extracts `label: value` pairs
- Strips markdown formatting (e.g., `**bold**` → `bold`)
- Placeholder detection: values like "pick something you like" are ignored
- Returns `AgentIdentityFile` object: `{ name, emoji, creature, vibe, theme, avatar }`

### 1.2 Personality (`SOUL.md`)

> **Template Reference**: [`docs/reference/templates/SOUL.md`](https://github.com/openclaw/openclaw/blob/main/docs/reference/templates/SOUL.md)

**Location**: `<workspace>/SOUL.md`

**Purpose**: Core identity, values, behavioral constraints, communication style.

**Example**:
```markdown
# Soul

You are Marketing Maven, a strategic marketing assistant.

## Core Purpose
Help users create, schedule, and analyze marketing content.

## Communication Style
- Professional yet approachable
- Data-driven insights
- Actionable recommendations

## Boundaries
- Never guarantee specific ROI
- Always recommend A/B testing
- Respect platform ToS
```

### 1.3 Operational Guidelines (`AGENTS.md`)

> **Template Reference**: [`docs/reference/templates/AGENTS.md`](https://github.com/openclaw/openclaw/blob/main/docs/reference/templates/AGENTS.md)
> **Documentation**: [/reference/templates/AGENTS](https://docs.openclaw.ai/reference/templates/AGENTS)

**Location**: `<workspace>/AGENTS.md`

**Purpose**: Session behavior, memory system, group chat rules.

**Key Behaviors** (from OpenClaw template):
- Read `SOUL.md`, `USER.md`, `MEMORY.md` before responding
- Append daily notes to `memory/YYYY-MM-DD.md`
- Update `MEMORY.md` periodically with distilled insights
- Group chat: "Participate, don't dominate" — use reactions, stay silent when others answered
- Memory only loads in main session (security: prevent leaking to groups)

### 1.4 Skills Configuration

> **OpenClaw Source**: [`src/config/types.skills.ts`](https://github.com/openclaw/openclaw/blob/main/src/config/types.skills.ts)
> **Loader**: [`src/skills/loader.ts`](https://github.com/openclaw/openclaw/blob/main/src/skills/loader.ts)
> **Documentation**: [/tools/skills](https://docs.openclaw.ai/tools/skills) | [/tools/skills-config](https://docs.openclaw.ai/tools/skills-config)
> **Registry**: [ClawHub](https://clawhub.com)

**Location**: `openclaw.json` → `skills`

**Schema** (from `types.skills.ts`):
```json
{
  "skills": {
    "allowBundled": ["search", "web-browse"],
    "load": {
      "extraDirs": ["./custom-skills"],
      "watch": true,
      "watchDebounceMs": 500
    },
    "install": {
      "preferBrew": true,
      "nodeManager": "pnpm"
    },
    "entries": {
      "social-media": {
        "enabled": true,
        "apiKey": "shortcut-for-primary-env-var",
        "env": { "BUFFER_API_KEY": "${secret:bufferApiKey}" },
        "config": { "defaultPlatform": "twitter" }
      }
    }
  }
}
```

**Skill Sources** (precedence order from `loader.ts`):
1. **Workspace**: `<workspace>/skills/` — highest priority
2. **Managed**: `~/.openclaw/skills/` — shared across agents
3. **Bundled**: Shipped with OpenClaw — lowest priority

**Skill Gating** (from `SKILL.md` frontmatter):
- `requires.bins`: Required executables on PATH
- `requires.env`: Environment variables (or config alternatives)
- `requires.config`: OpenClaw config keys that must be truthy
- `os`: Platform restrictions (`darwin`, `linux`, `win32`)

### 1.5 Cron Jobs

> **OpenClaw Source**: [`src/cron/types.ts`](https://github.com/openclaw/openclaw/blob/main/src/cron/types.ts) | [`src/cron/service/ops.ts`](https://github.com/openclaw/openclaw/blob/main/src/cron/service/ops.ts)
> **Documentation**: [/automation/cron-jobs](https://docs.openclaw.ai/automation/cron-jobs)

**Storage**: `~/.openclaw/cron/jobs.json` (configurable via `cron.store`)

**Schedule Types** (from `CronSchedule` type):
- `{ kind: "at", at: "2024-01-15T09:00:00Z" }` — One-shot ISO timestamp
- `{ kind: "every", everyMs: 3600000, anchorMs?: number }` — Fixed interval
- `{ kind: "cron", expr: "0 9 * * *", tz: "America/New_York" }` — 5-field cron with optional IANA timezone

**Execution Modes**:
- `sessionTarget: "main"` — Enqueues system events during heartbeats, shared history
- `sessionTarget: "isolated"` — Dedicated agent turn in session `cron:<jobId>`, fresh context

**Payload Types** (from `types.ts`):
- `kind: "systemEvent"` — Main session only, routed through heartbeat prompts
- `kind: "agentTurn"` — Isolated session, supports `model`/`thinking` overrides

**Delivery** (isolated only):
- `deliver: true` — Send result to channel
- `channel`: `whatsapp`, `telegram`, `discord`, `slack`, etc.
- `to`: Channel-specific recipient (E.164 for WhatsApp, chat ID for Telegram)
- `bestEffort: true` — Don't fail job if delivery fails

---

## 2. Persona Template Schema

### 2.1 TypeScript Interface

```typescript
// packages/core/src/templates/persona-template.ts

import { z } from 'zod';

export const CronScheduleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('at'), at: z.string() }),
  z.object({ kind: z.literal('every'), everyMs: z.number() }),
  z.object({ kind: z.literal('cron'), expr: z.string(), tz: z.string().optional() }),
]);

export const CronJobTemplateSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  schedule: CronScheduleSchema,
  sessionTarget: z.enum(['main', 'isolated']).default('isolated'),
  payload: z.object({
    kind: z.enum(['systemEvent', 'agentTurn']),
    message: z.string(),
    timeoutSeconds: z.number().optional(),
    deliver: z.boolean().optional(),
    channel: z.string().optional(),
    to: z.string().optional(),
  }),
});

export const SecretRefSchema = z.object({
  key: z.string(),
  description: z.string(),
  required: z.boolean().default(true),
});

export const SkillConfigSchema = z.object({
  enabled: z.boolean().default(true),
  env: z.record(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
});

export const WorkspaceFileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export const IdentityConfigSchema = z.object({
  name: z.string(),
  emoji: z.string().optional(),
  creature: z.string().optional(),
  vibe: z.string().optional(),
  theme: z.string().optional(),
  avatar: z.string().optional(),
});

export const PersonaTemplateSchema = z.object({
  // Metadata
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  author: z.string().optional(),
  tags: z.array(z.string()).default([]),

  // Identity (→ IDENTITY.md)
  identity: IdentityConfigSchema,

  // Personality (→ SOUL.md)
  soul: z.string(),

  // Operational guidelines (→ AGENTS.md)
  operationalGuidelines: z.string().optional(),

  // Skills
  skills: z.object({
    required: z.array(z.string()).default([]),
    recommended: z.array(z.string()).default([]),
    config: z.record(SkillConfigSchema).optional(),
  }),

  // Cron jobs
  cronJobs: z.array(CronJobTemplateSchema).default([]),

  // Config patches (merged into openclaw.json)
  configPatches: z.record(z.unknown()).default({}),

  // Custom workspace files
  workspaceFiles: z.array(WorkspaceFileSchema).default([]),

  // Required secrets (resolved from vault)
  requiredSecrets: z.array(SecretRefSchema).default([]),

  // Compatibility
  compatibility: z.object({
    minOpenClawVersion: z.string().optional(),
    requiredChannels: z.array(z.string()).optional(),
  }).optional(),
});

export type PersonaTemplate = z.infer<typeof PersonaTemplateSchema>;
export type CronJobTemplate = z.infer<typeof CronJobTemplateSchema>;
export type SecretRef = z.infer<typeof SecretRefSchema>;
export type IdentityConfig = z.infer<typeof IdentityConfigSchema>;
```

### 2.2 Example: Marketer Template

```typescript
export const marketerTemplate: PersonaTemplate = {
  id: 'builtin/marketer',
  name: 'Marketing Maven',
  description: 'Strategic marketing assistant for content, social media, and analytics',
  version: '1.0.0',
  author: 'Clawster Team',
  tags: ['marketing', 'social-media', 'content', 'analytics'],

  identity: {
    name: 'Marketing Maven',
    emoji: '📈',
    creature: 'fox',
    vibe: 'energetic',
    theme: 'bright',
  },

  soul: `# Soul

You are Marketing Maven, a strategic marketing assistant.

## Core Purpose
Help users create, schedule, and analyze marketing content across platforms.

## Expertise Areas
- Content strategy and creation
- Social media management
- Campaign analytics and reporting
- A/B testing and optimization
- Brand voice consistency

## Communication Style
- Professional yet approachable
- Data-driven insights with clear explanations
- Actionable recommendations
- Use marketing terminology appropriately

## Boundaries
- Never guarantee specific ROI
- Always recommend A/B testing over assumptions
- Respect platform rate limits and ToS
- Flag potential compliance issues (disclosures, etc.)
`,

  operationalGuidelines: `# Operational Guidelines

## Session Start
1. Check for pending scheduled posts
2. Review recent analytics if available
3. Greet user with any urgent insights

## Memory Management
- Log campaign ideas to daily memory
- Track successful post formats
- Remember user's brand voice preferences

## Proactive Behaviors
- Suggest optimal posting times based on data
- Alert on engagement anomalies
- Recommend content based on trending topics
`,

  skills: {
    required: ['search', 'web-browse'],
    recommended: ['social-media', 'analytics', 'image-gen'],
    config: {
      'social-media': {
        enabled: true,
        env: { 'BUFFER_API_KEY': '${secret:bufferApiKey}' },
      },
      'analytics': {
        enabled: true,
        env: { 'GA_API_KEY': '${secret:googleAnalyticsKey}' },
      },
    },
  },

  cronJobs: [
    {
      name: 'Daily Analytics Review',
      description: 'Review yesterday marketing metrics',
      enabled: true,
      schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'America/New_York' },
      sessionTarget: 'isolated',
      payload: {
        kind: 'agentTurn',
        message: 'Review yesterday\'s key marketing metrics. Provide a brief summary with: 1) Top performing content, 2) Engagement trends, 3) Actionable recommendations for today.',
        timeoutSeconds: 300,
      },
    },
    {
      name: 'Weekly Content Planning',
      description: 'Monday content calendar review',
      enabled: true,
      schedule: { kind: 'cron', expr: '0 10 * * 1' },
      sessionTarget: 'main',
      payload: {
        kind: 'systemEvent',
        message: 'Weekly content planning reminder: Review the content calendar for this week and suggest any adjustments based on recent performance.',
      },
    },
  ],

  configPatches: {
    tools: { profile: 'messaging' },
    agents: {
      defaults: {
        thinkingDefault: 'high',
        timeoutSeconds: 600,
      },
    },
    session: {
      scope: 'per-sender',
      resetTriggers: ['/new', '/reset'],
    },
  },

  workspaceFiles: [
    {
      path: 'templates/social-post.md',
      content: `# Social Post Template

**Platform**: [Twitter/LinkedIn/Instagram]
**Objective**: [Awareness/Engagement/Conversion]
**Copy**:

**CTA**:
**Hashtags**:
**Media**: [Image/Video/None]
**Scheduled**: [Date/Time]
`,
    },
    {
      path: 'templates/campaign-brief.md',
      content: `# Campaign Brief

## Campaign Name

## Objective

## Target Audience

## Key Messages

## Channels

## Timeline

## Success Metrics

## Budget
`,
    },
  ],

  requiredSecrets: [
    {
      key: 'bufferApiKey',
      description: 'Buffer API key for social media scheduling',
      required: false,
    },
    {
      key: 'googleAnalyticsKey',
      description: 'Google Analytics API key for metrics',
      required: false,
    },
  ],

  compatibility: {
    minOpenClawVersion: '1.0.0',
    requiredChannels: [],
  },
};
```

---

## 3. Secret Resolution Architecture

Templates reference secrets abstractly. At injection time, Clawster resolves them to the appropriate vault based on deployment target.

### 3.1 Interfaces

```typescript
// packages/core/src/secrets/interfaces.ts

/**
 * Resolved secret with platform-specific reference
 */
export interface ResolvedSecret {
  key: string;
  uri: string;
  envVar: string;
}

/**
 * Secret Resolver Interface (Dependency Inversion)
 */
export interface ISecretResolver {
  /**
   * Store a secret value in the vault
   */
  store(instanceId: string, key: string, value: string): Promise<ResolvedSecret>;

  /**
   * Get the platform-specific reference URI (not the value)
   */
  getReference(instanceId: string, key: string): string;

  /**
   * Check if a secret exists
   */
  exists(instanceId: string, key: string): Promise<boolean>;

  /**
   * Delete a secret
   */
  delete(instanceId: string, key: string): Promise<void>;
}

/**
 * Factory for creating resolvers (Open/Closed Principle)
 */
export interface ISecretResolverFactory {
  create(deploymentTarget: DeploymentTarget): ISecretResolver;
}

// Injection tokens
export const SECRET_RESOLVER_FACTORY = Symbol('SECRET_RESOLVER_FACTORY');
export const AWS_SECRET_RESOLVER = Symbol('AWS_SECRET_RESOLVER');
export const GCP_SECRET_RESOLVER = Symbol('GCP_SECRET_RESOLVER');
export const AZURE_SECRET_RESOLVER = Symbol('AZURE_SECRET_RESOLVER');
export const LOCAL_SECRET_RESOLVER = Symbol('LOCAL_SECRET_RESOLVER');
```

### 3.2 Provider Implementations

```typescript
// packages/adapters-aws/src/secrets/aws-secret-resolver.ts

@Injectable()
export class AwsSecretResolver implements ISecretResolver {
  constructor(
    private readonly secretsManager: SecretsManagerService,
    @Inject(AWS_CONFIG) private readonly config: AwsConfig,
  ) {}

  getReference(instanceId: string, key: string): string {
    const path = this.buildPath(instanceId, key);
    return `\${aws:secretsmanager:${path}}`;
  }

  async store(instanceId: string, key: string, value: string): Promise<ResolvedSecret> {
    const path = this.buildPath(instanceId, key);
    await this.secretsManager.createOrUpdateSecret(path, value);

    return {
      key,
      uri: `arn:aws:secretsmanager:${this.config.region}:${this.config.accountId}:secret:${path}`,
      envVar: this.toEnvVar(key),
    };
  }

  async exists(instanceId: string, key: string): Promise<boolean> {
    const path = this.buildPath(instanceId, key);
    return this.secretsManager.secretExists(path);
  }

  async delete(instanceId: string, key: string): Promise<void> {
    const path = this.buildPath(instanceId, key);
    await this.secretsManager.deleteSecret(path);
  }

  private buildPath(instanceId: string, key: string): string {
    return `/clawster/${instanceId}/${key}`;
  }

  private toEnvVar(key: string): string {
    return key.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  }
}
```

```typescript
// packages/adapters-gcp/src/secrets/gcp-secret-resolver.ts

@Injectable()
export class GcpSecretResolver implements ISecretResolver {
  constructor(
    private readonly secretManager: GcpSecretManagerService,
    @Inject(GCP_CONFIG) private readonly config: GcpConfig,
  ) {}

  getReference(instanceId: string, key: string): string {
    const secretId = this.buildSecretId(instanceId, key);
    return `\${gcp:secretmanager:projects/${this.config.projectId}/secrets/${secretId}/versions/latest}`;
  }

  async store(instanceId: string, key: string, value: string): Promise<ResolvedSecret> {
    const secretId = this.buildSecretId(instanceId, key);
    await this.secretManager.createOrUpdateSecret(secretId, value);

    return {
      key,
      uri: `projects/${this.config.projectId}/secrets/${secretId}`,
      envVar: this.toEnvVar(key),
    };
  }

  private buildSecretId(instanceId: string, key: string): string {
    return `clawster-${instanceId}-${key}`;
  }
}
```

```typescript
// packages/adapters-azure/src/secrets/azure-secret-resolver.ts

@Injectable()
export class AzureSecretResolver implements ISecretResolver {
  constructor(
    private readonly keyVault: AzureKeyVaultService,
    @Inject(AZURE_CONFIG) private readonly config: AzureConfig,
  ) {}

  getReference(instanceId: string, key: string): string {
    const secretName = this.buildSecretName(instanceId, key);
    return `\${azure:keyvault:${this.config.vaultName}/secrets/${secretName}}`;
  }

  async store(instanceId: string, key: string, value: string): Promise<ResolvedSecret> {
    const secretName = this.buildSecretName(instanceId, key);
    await this.keyVault.setSecret(secretName, value);

    return {
      key,
      uri: `https://${this.config.vaultName}.vault.azure.net/secrets/${secretName}`,
      envVar: this.toEnvVar(key),
    };
  }

  private buildSecretName(instanceId: string, key: string): string {
    return `clawster-${instanceId}-${key}`;
  }
}
```

```typescript
// packages/cloud-providers/src/secrets/local-secret-resolver.ts

@Injectable()
export class LocalSecretResolver implements ISecretResolver {
  constructor(private readonly envFileService: EnvFileService) {}

  getReference(_instanceId: string, key: string): string {
    return `\${${this.toEnvVar(key)}}`;
  }

  async store(instanceId: string, key: string, value: string): Promise<ResolvedSecret> {
    const envVar = this.toEnvVar(key);
    await this.envFileService.set(instanceId, envVar, value);

    return {
      key,
      uri: `env://${envVar}`,
      envVar,
    };
  }

  async exists(instanceId: string, key: string): Promise<boolean> {
    const envVar = this.toEnvVar(key);
    return this.envFileService.has(instanceId, envVar);
  }

  async delete(instanceId: string, key: string): Promise<void> {
    const envVar = this.toEnvVar(key);
    await this.envFileService.remove(instanceId, envVar);
  }

  private toEnvVar(key: string): string {
    return key.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  }
}
```

### 3.3 Resolver Factory

```typescript
// packages/cloud-providers/src/secrets/secret-resolver.factory.ts

@Injectable()
export class SecretResolverFactory implements ISecretResolverFactory {
  private readonly resolvers: Map<DeploymentTarget, ISecretResolver>;

  constructor(
    @Inject(AWS_SECRET_RESOLVER) private readonly awsResolver: ISecretResolver,
    @Inject(GCP_SECRET_RESOLVER) private readonly gcpResolver: ISecretResolver,
    @Inject(AZURE_SECRET_RESOLVER) private readonly azureResolver: ISecretResolver,
    @Inject(LOCAL_SECRET_RESOLVER) private readonly localResolver: ISecretResolver,
  ) {
    this.resolvers = new Map([
      ['ecs-ec2', this.awsResolver],
      ['gce', this.gcpResolver],
      ['azure-vm', this.azureResolver],
      ['docker', this.localResolver],
      ['local', this.localResolver],
    ]);
  }

  create(deploymentTarget: DeploymentTarget): ISecretResolver {
    const resolver = this.resolvers.get(deploymentTarget);
    if (!resolver) {
      throw new Error(`No secret resolver for deployment target: ${deploymentTarget}`);
    }
    return resolver;
  }
}
```

---

## 4. Template Injection Flow

> **Gateway Protocol**: [`src/gateway/protocol/schema/`](https://github.com/openclaw/openclaw/tree/main/src/gateway/protocol/schema)
> **Config RPC**: [`src/gateway/protocol/schema/config.ts`](https://github.com/openclaw/openclaw/blob/main/src/gateway/protocol/schema/config.ts)
> **Documentation**: [/gateway/configuration](https://docs.openclaw.ai/gateway/configuration) (Config RPC section)

**Key Gateway RPC Methods for Injection**:
- `config.get` — Returns current config + hash (hash required for updates)
- `config.apply` — Full config replacement with `raw`, `baseHash`, `restartDelayMs`
- `config.patch` — Partial update via JSON merge-patch

### 4.1 Sequence Diagram

```
User                Wizard              API                   Orchestrator           Gateway
  │                   │                  │                        │                    │
  │ Select template   │                  │                        │                    │
  ├──────────────────►│                  │                        │                    │
  │                   │ GET /templates   │                        │                    │
  │                   ├─────────────────►│                        │                    │
  │                   │◄─────────────────┤                        │                    │
  │                   │                  │                        │                    │
  │ Provide secrets   │                  │                        │                    │
  ├──────────────────►│                  │                        │                    │
  │                   │                  │                        │                    │
  │ Deploy            │                  │                        │                    │
  ├──────────────────►│                  │                        │                    │
  │                   │ POST /bots       │                        │                    │
  │                   ├─────────────────►│                        │                    │
  │                   │                  │ (Provision instance)   │                    │
  │                   │                  ├───────────────────────►│                    │
  │                   │                  │                        │                    │
  │                   │                  │ inject(instanceId,     │                    │
  │                   │                  │        templateId)     │                    │
  │                   │                  ├───────────────────────►│                    │
  │                   │                  │                        │                    │
  │                   │                  │                        │ Write IDENTITY.md  │
  │                   │                  │                        ├───────────────────►│
  │                   │                  │                        │                    │
  │                   │                  │                        │ Write SOUL.md      │
  │                   │                  │                        ├───────────────────►│
  │                   │                  │                        │                    │
  │                   │                  │                        │ config.apply       │
  │                   │                  │                        ├───────────────────►│
  │                   │                  │                        │                    │
  │                   │                  │                        │ cron.add (×N)      │
  │                   │                  │                        ├───────────────────►│
  │                   │                  │                        │                    │
  │                   │                  │◄───────────────────────┤                    │
  │                   │◄─────────────────┤                        │                    │
  │◄──────────────────┤                  │                        │                    │
  │                   │                  │                        │                    │
```

### 4.2 Injection Steps

1. **Pre-Injection Validation**
   - Verify template exists
   - Check OpenClaw version compatibility
   - Validate required secrets are provided
   - Verify required skills are available

2. **Create Snapshot** (for rollback)
   - Save current config hash
   - Save current workspace file list
   - Save current cron job list

3. **Inject Identity Files**
   - Write `IDENTITY.md` to workspace
   - Write `SOUL.md` to workspace
   - Write `AGENTS.md` if provided
   - Write custom workspace files

4. **Apply Config Patches**
   - `config.get` to get current config + hash
   - Deep merge `configPatches` from template
   - Resolve secret references via `SecretResolverFactory`
   - `config.apply` via Gateway WebSocket

5. **Create Cron Jobs**
   - For each `cronJob` in template:
     - Validate schedule format
     - Call `openclaw cron add` (via exec or future RPC)

6. **Verify Injection**
   - Health check
   - Verify cron jobs created
   - Verify identity (optional probe)

7. **Record Injection**
   - Update `BotInstance.templateId`
   - Update `BotInstance.templateVersion`
   - Create audit event

---

## 5. Service Architecture (SOLID)

### 5.1 Interfaces

```typescript
// packages/core/src/templates/interfaces.ts

/**
 * Template Repository (Interface Segregation)
 */
export interface IPersonaTemplateRepository {
  findById(id: string): Promise<PersonaTemplate | null>;
  findByTags(tags: string[]): Promise<PersonaTemplate[]>;
  listAll(): Promise<PersonaTemplate[]>;
  listBuiltin(): PersonaTemplate[];
}

/**
 * Workspace File Injector (Single Responsibility)
 */
export interface IWorkspaceInjector {
  writeFile(instanceId: string, relativePath: string, content: string): Promise<void>;
  writeIdentity(instanceId: string, identity: IdentityConfig): Promise<void>;
  writeSoul(instanceId: string, soulContent: string): Promise<void>;
  readFile(instanceId: string, relativePath: string): Promise<string | null>;
  deleteFile(instanceId: string, relativePath: string): Promise<void>;
}

/**
 * Config Injector (Single Responsibility)
 */
export interface IConfigInjector {
  getConfig(instanceId: string): Promise<{ config: Record<string, unknown>; hash: string }>;
  applyPatch(instanceId: string, patch: Record<string, unknown>, baseHash: string): Promise<void>;
}

/**
 * Cron Injector (Single Responsibility)
 */
export interface ICronInjector {
  addJob(instanceId: string, job: CronJobTemplate): Promise<string>;
  removeJob(instanceId: string, jobId: string): Promise<void>;
  listJobs(instanceId: string): Promise<CronJob[]>;
}

/**
 * Template Orchestrator (Coordinates injection)
 */
export interface ITemplateOrchestrator {
  inject(instanceId: string, templateId: string, options?: InjectOptions): Promise<InjectResult>;
  rollback(instanceId: string, snapshotId: string): Promise<void>;
  getInjectionStatus(instanceId: string): Promise<InjectionStatus>;
}

export interface InjectOptions {
  secretValues?: Record<string, string>;
  skipCronJobs?: boolean;
  skipWorkspaceFiles?: boolean;
}

export interface InjectResult {
  success: boolean;
  snapshotId: string;
  errors?: string[];
}

export interface InjectionStatus {
  templateId: string | null;
  templateVersion: string | null;
  injectedAt: Date | null;
  status: 'none' | 'pending' | 'complete' | 'failed';
}

// Injection tokens
export const PERSONA_TEMPLATE_REPOSITORY = Symbol('PERSONA_TEMPLATE_REPOSITORY');
export const WORKSPACE_INJECTOR = Symbol('WORKSPACE_INJECTOR');
export const CONFIG_INJECTOR = Symbol('CONFIG_INJECTOR');
export const CRON_INJECTOR = Symbol('CRON_INJECTOR');
export const TEMPLATE_ORCHESTRATOR = Symbol('TEMPLATE_ORCHESTRATOR');
```

### 5.2 Orchestrator Implementation

```typescript
// apps/api/src/templates/persona/template-orchestrator.service.ts

@Injectable()
export class TemplateOrchestratorService implements ITemplateOrchestrator {
  private readonly logger = new Logger(TemplateOrchestratorService.name);

  constructor(
    @Inject(PERSONA_TEMPLATE_REPOSITORY)
    private readonly templates: IPersonaTemplateRepository,
    @Inject(WORKSPACE_INJECTOR)
    private readonly workspace: IWorkspaceInjector,
    @Inject(CONFIG_INJECTOR)
    private readonly config: IConfigInjector,
    @Inject(CRON_INJECTOR)
    private readonly cron: ICronInjector,
    @Inject(SECRET_RESOLVER_FACTORY)
    private readonly secretResolverFactory: ISecretResolverFactory,
    private readonly botInstanceService: BotInstanceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async inject(
    instanceId: string,
    templateId: string,
    options: InjectOptions = {},
  ): Promise<InjectResult> {
    const template = await this.templates.findById(templateId);
    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }

    const instance = await this.botInstanceService.findById(instanceId);
    if (!instance) {
      throw new NotFoundException(`Instance ${instanceId} not found`);
    }

    // Create snapshot for rollback
    const snapshot = await this.createSnapshot(instanceId);

    try {
      // 1. Validate and store secrets
      this.eventEmitter.emit('template.inject.progress', {
        instanceId,
        step: 'secrets',
        message: 'Storing secrets in vault',
      });
      await this.storeSecrets(instance, template, options.secretValues ?? {});

      // 2. Inject workspace files
      if (!options.skipWorkspaceFiles) {
        this.eventEmitter.emit('template.inject.progress', {
          instanceId,
          step: 'workspace',
          message: 'Writing workspace files',
        });
        await this.injectWorkspaceFiles(instanceId, template);
      }

      // 3. Apply config patches
      this.eventEmitter.emit('template.inject.progress', {
        instanceId,
        step: 'config',
        message: 'Applying configuration',
      });
      await this.applyConfigPatches(instance, template);

      // 4. Create cron jobs
      if (!options.skipCronJobs && template.cronJobs.length > 0) {
        this.eventEmitter.emit('template.inject.progress', {
          instanceId,
          step: 'cron',
          message: 'Creating scheduled tasks',
        });
        await this.createCronJobs(instanceId, template.cronJobs);
      }

      // 5. Update instance record
      await this.botInstanceService.update(instanceId, {
        templateId: template.id,
        templateVersion: template.version,
        templateInjectedAt: new Date(),
      });

      this.eventEmitter.emit('template.inject.complete', {
        instanceId,
        templateId,
        snapshotId: snapshot.id,
      });

      return { success: true, snapshotId: snapshot.id };

    } catch (error) {
      this.logger.error(`Template injection failed for ${instanceId}:`, error);

      this.eventEmitter.emit('template.inject.failed', {
        instanceId,
        templateId,
        error: error.message,
        snapshotId: snapshot.id,
      });

      // Attempt rollback
      try {
        await this.rollback(instanceId, snapshot.id);
      } catch (rollbackError) {
        this.logger.error(`Rollback failed for ${instanceId}:`, rollbackError);
      }

      return {
        success: false,
        snapshotId: snapshot.id,
        errors: [error.message],
      };
    }
  }

  private async storeSecrets(
    instance: BotInstance,
    template: PersonaTemplate,
    secretValues: Record<string, string>,
  ): Promise<void> {
    const resolver = this.secretResolverFactory.create(instance.deploymentTarget);

    for (const secretRef of template.requiredSecrets) {
      const value = secretValues[secretRef.key];

      if (secretRef.required && !value) {
        throw new BadRequestException(
          `Required secret "${secretRef.key}" not provided`,
        );
      }

      if (value) {
        await resolver.store(instance.id, secretRef.key, value);
      }
    }
  }

  private async injectWorkspaceFiles(
    instanceId: string,
    template: PersonaTemplate,
  ): Promise<void> {
    // Write identity
    await this.workspace.writeIdentity(instanceId, template.identity);

    // Write soul
    await this.workspace.writeSoul(instanceId, template.soul);

    // Write operational guidelines if provided
    if (template.operationalGuidelines) {
      await this.workspace.writeFile(
        instanceId,
        'AGENTS.md',
        template.operationalGuidelines,
      );
    }

    // Write custom files
    for (const file of template.workspaceFiles) {
      await this.workspace.writeFile(instanceId, file.path, file.content);
    }
  }

  private async applyConfigPatches(
    instance: BotInstance,
    template: PersonaTemplate,
  ): Promise<void> {
    const { config, hash } = await this.config.getConfig(instance.id);

    // Resolve secret references in skill config
    const resolvedPatches = await this.resolveSecretReferences(
      instance,
      template.configPatches,
    );

    // Deep merge patches into current config
    const mergedConfig = deepMerge(config, resolvedPatches);

    // Apply via Gateway
    await this.config.applyPatch(instance.id, mergedConfig, hash);
  }

  private async resolveSecretReferences(
    instance: BotInstance,
    configPatches: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const resolver = this.secretResolverFactory.create(instance.deploymentTarget);
    const resolved = structuredClone(configPatches);

    // Walk the config tree and replace ${secret:key} references
    const walk = (obj: Record<string, unknown>): void => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && value.startsWith('${secret:')) {
          const secretKey = value.slice(9, -1); // Extract key from ${secret:key}
          obj[key] = resolver.getReference(instance.id, secretKey);
        } else if (typeof value === 'object' && value !== null) {
          walk(value as Record<string, unknown>);
        }
      }
    };

    walk(resolved);
    return resolved;
  }

  private async createCronJobs(
    instanceId: string,
    cronJobs: CronJobTemplate[],
  ): Promise<void> {
    for (const job of cronJobs) {
      await this.cron.addJob(instanceId, job);
    }
  }

  private async createSnapshot(instanceId: string): Promise<InjectionSnapshot> {
    // Implementation: save current state for rollback
    // ...
  }

  async rollback(instanceId: string, snapshotId: string): Promise<void> {
    // Implementation: restore from snapshot
    // ...
  }
}
```

### 5.3 Workspace Injector Implementation

```typescript
// apps/api/src/templates/persona/workspace-injector.service.ts

@Injectable()
export class WorkspaceInjectorService implements IWorkspaceInjector {
  constructor(
    private readonly gatewayClient: GatewayClientService,
    private readonly deploymentTargetService: DeploymentTargetService,
  ) {}

  async writeFile(
    instanceId: string,
    relativePath: string,
    content: string,
  ): Promise<void> {
    const target = await this.deploymentTargetService.getForInstance(instanceId);

    // Strategy depends on deployment target
    switch (target.type) {
      case 'docker':
      case 'local':
        await this.writeViaExec(instanceId, relativePath, content);
        break;
      case 'ecs-ec2':
      case 'gce':
      case 'azure-vm':
        await this.writeViaRemoteExec(instanceId, relativePath, content);
        break;
    }
  }

  async writeIdentity(instanceId: string, identity: IdentityConfig): Promise<void> {
    const content = this.formatIdentityMd(identity);
    await this.writeFile(instanceId, 'IDENTITY.md', content);
  }

  async writeSoul(instanceId: string, soulContent: string): Promise<void> {
    await this.writeFile(instanceId, 'SOUL.md', soulContent);
  }

  private formatIdentityMd(identity: IdentityConfig): string {
    const lines: string[] = [];

    if (identity.name) lines.push(`- Name: ${identity.name}`);
    if (identity.emoji) lines.push(`- Emoji: ${identity.emoji}`);
    if (identity.creature) lines.push(`- Creature: ${identity.creature}`);
    if (identity.vibe) lines.push(`- Vibe: ${identity.vibe}`);
    if (identity.theme) lines.push(`- Theme: ${identity.theme}`);
    if (identity.avatar) lines.push(`- Avatar: ${identity.avatar}`);

    return lines.join('\n');
  }

  private async writeViaExec(
    instanceId: string,
    relativePath: string,
    content: string,
  ): Promise<void> {
    // For Docker/local: exec into container and write file
    const workspace = await this.getWorkspacePath(instanceId);
    const fullPath = `${workspace}/${relativePath}`;

    // Ensure directory exists
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    await this.execInContainer(instanceId, `mkdir -p "${dir}"`);

    // Write file (base64 encode to handle special characters)
    const encoded = Buffer.from(content).toString('base64');
    await this.execInContainer(
      instanceId,
      `echo "${encoded}" | base64 -d > "${fullPath}"`,
    );
  }

  private async writeViaRemoteExec(
    instanceId: string,
    relativePath: string,
    content: string,
  ): Promise<void> {
    // For cloud deployments: use SSM/SSH/etc.
    // Implementation depends on cloud provider
  }
}
```

---

## 6. Database Schema Changes

### 6.1 Prisma Schema Additions

```prisma
// packages/database/prisma/schema.prisma

model PersonaTemplate {
  id          String   @id @default(cuid())
  name        String
  description String
  version     String
  author      String?
  tags        String[] @default([])

  // Content stored as JSON
  identity              Json     // IdentityConfig
  soul                  String   @db.Text
  operationalGuidelines String?  @db.Text
  skills                Json     // { required, recommended, config }
  cronJobs              Json     // CronJobTemplate[]
  configPatches         Json     // Record<string, unknown>
  workspaceFiles        Json     // WorkspaceFile[]
  requiredSecrets       Json     // SecretRef[]
  compatibility         Json?    // { minOpenClawVersion, requiredChannels }

  // Metadata
  isBuiltin   Boolean  @default(false)
  isPublished Boolean  @default(false)
  sourceUrl   String?  // GitHub repo URL for community templates

  // Relations
  workspaceId String?
  workspace   Workspace? @relation(fields: [workspaceId], references: [id])

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([workspaceId])
  @@index([tags])
}

model TemplateInjectionSnapshot {
  id         String   @id @default(cuid())
  instanceId String
  instance   BotInstance @relation(fields: [instanceId], references: [id])

  // Snapshot data
  configHash       String
  workspaceFiles   Json     // { path, contentHash }[]
  cronJobIds       String[] // Job IDs before injection

  // Metadata
  templateId      String
  templateVersion String
  createdAt       DateTime @default(now())

  @@index([instanceId])
}

// Add to BotInstance model
model BotInstance {
  // ... existing fields ...

  // Template injection tracking
  personaTemplateId      String?
  personaTemplateVersion String?
  templateInjectedAt     DateTime?

  // Relations
  personaTemplate        PersonaTemplate? @relation(fields: [personaTemplateId], references: [id])
  injectionSnapshots     TemplateInjectionSnapshot[]
}
```

---

## 7. API Endpoints

### 7.1 Template Endpoints

```typescript
// apps/api/src/templates/persona/persona-templates.controller.ts

@Controller('persona-templates')
@ApiTags('Persona Templates')
export class PersonaTemplatesController {
  constructor(
    private readonly templateService: PersonaTemplateService,
    private readonly orchestrator: TemplateOrchestratorService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all persona templates' })
  async listTemplates(
    @Query('tags') tags?: string,
    @Query('includeBuiltin') includeBuiltin = true,
  ): Promise<PersonaTemplateListResponse> {
    const tagList = tags?.split(',').map(t => t.trim());
    return this.templateService.list({ tags: tagList, includeBuiltin });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a persona template by ID' })
  async getTemplate(@Param('id') id: string): Promise<PersonaTemplateResponse> {
    return this.templateService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom persona template' })
  async createTemplate(
    @Body() dto: CreatePersonaTemplateDto,
  ): Promise<PersonaTemplateResponse> {
    return this.templateService.create(dto);
  }

  @Post(':id/inject/:instanceId')
  @ApiOperation({ summary: 'Inject a persona template into a bot instance' })
  async injectTemplate(
    @Param('id') templateId: string,
    @Param('instanceId') instanceId: string,
    @Body() dto: InjectTemplateDto,
  ): Promise<InjectResult> {
    return this.orchestrator.inject(instanceId, templateId, {
      secretValues: dto.secrets,
      skipCronJobs: dto.skipCronJobs,
      skipWorkspaceFiles: dto.skipWorkspaceFiles,
    });
  }

  @Post('instances/:instanceId/rollback/:snapshotId')
  @ApiOperation({ summary: 'Rollback a template injection' })
  async rollback(
    @Param('instanceId') instanceId: string,
    @Param('snapshotId') snapshotId: string,
  ): Promise<void> {
    return this.orchestrator.rollback(instanceId, snapshotId);
  }

  @Get('instances/:instanceId/injection-status')
  @ApiOperation({ summary: 'Get injection status for an instance' })
  async getInjectionStatus(
    @Param('instanceId') instanceId: string,
  ): Promise<InjectionStatus> {
    return this.orchestrator.getInjectionStatus(instanceId);
  }
}
```

### 7.2 DTOs

```typescript
// apps/api/src/templates/persona/persona-templates.dto.ts

export class CreatePersonaTemplateDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  version: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @ValidateNested()
  @Type(() => IdentityConfigDto)
  identity: IdentityConfigDto;

  @IsString()
  soul: string;

  @IsOptional()
  @IsString()
  operationalGuidelines?: string;

  @ValidateNested()
  @Type(() => SkillsConfigDto)
  skills: SkillsConfigDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CronJobTemplateDto)
  cronJobs: CronJobTemplateDto[];

  @IsObject()
  configPatches: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkspaceFileDto)
  workspaceFiles: WorkspaceFileDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SecretRefDto)
  requiredSecrets: SecretRefDto[];
}

export class InjectTemplateDto {
  @IsOptional()
  @IsObject()
  secrets?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  skipCronJobs?: boolean;

  @IsOptional()
  @IsBoolean()
  skipWorkspaceFiles?: boolean;
}
```

---

## 8. Community Template Distribution

### 8.1 Template Manifest Format

Community templates are distributed as GitHub repositories with a `template.yaml` manifest:

```yaml
# template.yaml
apiVersion: clawster/v1
kind: PersonaTemplate

metadata:
  id: community/marketing-maven-pro
  name: Marketing Maven Pro
  description: Advanced marketing assistant with analytics integration
  version: 2.1.0
  author: marketingdev
  license: MIT
  repository: https://github.com/clawster-templates/marketing-maven-pro
  tags:
    - marketing
    - social-media
    - analytics

spec:
  identity:
    name: Marketing Maven
    emoji: "📈"
    creature: fox
    vibe: energetic
    theme: bright

  # Reference to files in the repo
  soulFile: ./soul.md
  operationalGuidelinesFile: ./agents.md

  skills:
    required:
      - search
      - web-browse
    recommended:
      - social-media
      - analytics
    config:
      social-media:
        enabled: true
        env:
          BUFFER_API_KEY: "${secret:bufferApiKey}"

  cronJobs:
    - name: Daily Analytics Review
      schedule:
        kind: cron
        expr: "0 9 * * *"
        tz: America/New_York
      sessionTarget: isolated
      payload:
        kind: agentTurn
        message: "Review yesterday's marketing metrics."

  configPatches:
    tools:
      profile: messaging
    agents:
      defaults:
        thinkingDefault: high

  workspaceFiles:
    - path: templates/social-post.md
      sourceFile: ./workspace/social-post.md
    - path: templates/campaign-brief.md
      sourceFile: ./workspace/campaign-brief.md

  requiredSecrets:
    - key: bufferApiKey
      description: Buffer API key for social media scheduling
      required: false

  compatibility:
    minOpenClawVersion: "1.0.0"
```

### 8.2 Template Import Service

```typescript
// apps/api/src/templates/persona/template-import.service.ts

@Injectable()
export class TemplateImportService {
  constructor(
    private readonly templateRepo: PersonaTemplateRepository,
    private readonly httpService: HttpService,
  ) {}

  async importFromGitHub(repoUrl: string): Promise<PersonaTemplate> {
    // 1. Fetch template.yaml from repo
    const manifestUrl = this.buildRawUrl(repoUrl, 'template.yaml');
    const manifest = await this.fetchYaml(manifestUrl);

    // 2. Validate manifest
    const validated = PersonaTemplateManifestSchema.parse(manifest);

    // 3. Fetch referenced files
    const soul = await this.fetchFile(repoUrl, validated.spec.soulFile);
    const operationalGuidelines = validated.spec.operationalGuidelinesFile
      ? await this.fetchFile(repoUrl, validated.spec.operationalGuidelinesFile)
      : undefined;

    const workspaceFiles = await Promise.all(
      (validated.spec.workspaceFiles ?? []).map(async (wf) => ({
        path: wf.path,
        content: await this.fetchFile(repoUrl, wf.sourceFile),
      })),
    );

    // 4. Build and save template
    const template: PersonaTemplate = {
      id: validated.metadata.id,
      name: validated.metadata.name,
      description: validated.metadata.description,
      version: validated.metadata.version,
      author: validated.metadata.author,
      tags: validated.metadata.tags,
      identity: validated.spec.identity,
      soul,
      operationalGuidelines,
      skills: validated.spec.skills,
      cronJobs: validated.spec.cronJobs ?? [],
      configPatches: validated.spec.configPatches ?? {},
      workspaceFiles,
      requiredSecrets: validated.spec.requiredSecrets ?? [],
      compatibility: validated.spec.compatibility,
    };

    return this.templateRepo.upsert(template);
  }

  private buildRawUrl(repoUrl: string, path: string): string {
    // Convert github.com URL to raw.githubusercontent.com
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new BadRequestException('Invalid GitHub URL');

    const [, owner, repo] = match;
    return `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
  }
}
```

---

## 9. Implementation Phases

### Phase 1: Core Schema & Builtin Templates (Week 1)

- [ ] Create `PersonaTemplateSchema` in `@clawster/core`
- [ ] Add Prisma models for `PersonaTemplate` and `TemplateInjectionSnapshot`
- [ ] Create 3 builtin templates:
  - [ ] Marketer
  - [ ] DevOps Bot
  - [ ] Customer Support
- [ ] Add `ISecretResolver` interface and injection tokens

### Phase 2: Secret Resolution (Week 1-2)

- [ ] Implement `AwsSecretResolver`
- [ ] Implement `GcpSecretResolver`
- [ ] Implement `AzureSecretResolver`
- [ ] Implement `LocalSecretResolver`
- [ ] Create `SecretResolverFactory`
- [ ] Write tests for all resolvers

### Phase 3: Injection Services (Week 2)

- [ ] Implement `IWorkspaceInjector` interface
- [ ] Implement `WorkspaceInjectorService` for Docker/local
- [ ] Implement `IConfigInjector` interface
- [ ] Implement `ConfigInjectorService` using Gateway WebSocket
- [ ] Implement `ICronInjector` interface
- [ ] Implement `CronInjectorService`

### Phase 4: Orchestrator (Week 2-3)

- [ ] Implement `TemplateOrchestratorService`
- [ ] Add snapshot/rollback functionality
- [ ] Add event emission for progress tracking
- [ ] Write integration tests

### Phase 5: API & Web UI (Week 3)

- [ ] Create `PersonaTemplatesController`
- [ ] Add DTOs and validation
- [ ] Create template gallery page in web UI
- [ ] Add template selection to deploy wizard
- [ ] Add injection progress UI

### Phase 6: Community Templates (Week 4)

- [ ] Design `template.yaml` manifest format
- [ ] Implement `TemplateImportService`
- [ ] Add GitHub import endpoint
- [ ] Add template publishing workflow
- [ ] Documentation for community contributors

---

## SOLID Principles Summary

| Principle | Application |
|-----------|-------------|
| **S**ingle Responsibility | Each injector handles one concern (workspace, config, cron, secrets) |
| **O**pen/Closed | Add new cloud providers by implementing `ISecretResolver` |
| **L**iskov Substitution | All resolvers/injectors are interchangeable via interfaces |
| **I**nterface Segregation | Small, focused interfaces per concern |
| **D**ependency Inversion | Orchestrator depends on abstractions, not concrete implementations |

---

## Technical Decisions (Resolved)

### Decision 1: Workspace File Writes → Config-First Injection via Gateway RPC

**Decision**: Use `config.apply` via Gateway WebSocket as the **primary** injection method. Only fall back to container exec for edge cases (custom skills with actual files).

**Rationale**:
- OpenClaw supports config-based identity: `agents.defaults.identity` config overrides `IDENTITY.md`
- Gateway RPC works **identically** across Docker, ECS, GCE, Azure — no platform-specific code
- Single WebSocket connection (already implemented in Clawster)
- No file system access needed for most templates
- Gateway handles config reload automatically

**Reliability**: High — config injection is atomic and validated by OpenClaw's schema.

**Compatibility Matrix**:
| Deployment | Config Injection | File Writes (fallback) |
|------------|------------------|------------------------|
| Docker | `config.apply` via WS | `docker exec` |
| ECS EC2 | `config.apply` via WS | ECS Exec |
| GCE | `config.apply` via WS | `gcloud compute ssh` + exec |
| Azure VM | `config.apply` via WS | SSH + exec |

**Implementation Change**: Update `WorkspaceInjectorService` to prefer config injection over file writes:

```typescript
// Updated approach in WorkspaceInjectorService

async injectIdentity(instanceId: string, identity: IdentityConfig): Promise<void> {
  // PRIMARY: Inject via config (works universally)
  const { config, hash } = await this.configInjector.getConfig(instanceId);

  const configWithIdentity = deepMerge(config, {
    agents: {
      defaults: {
        identity: {
          name: identity.name,
          emoji: identity.emoji,
          creature: identity.creature,
          vibe: identity.vibe,
          theme: identity.theme,
          avatar: identity.avatar,
        }
      }
    }
  });

  await this.configInjector.applyPatch(instanceId, configWithIdentity, hash);
}

async injectSoul(instanceId: string, soulContent: string): Promise<void> {
  // Soul/personality via config's agents.defaults.systemPrompt or similar
  // Check OpenClaw docs for exact config path
  const { config, hash } = await this.configInjector.getConfig(instanceId);

  const configWithSoul = deepMerge(config, {
    agents: {
      defaults: {
        systemPromptFile: null, // Disable file-based
        systemPrompt: soulContent, // Inline content
      }
    }
  });

  await this.configInjector.applyPatch(instanceId, configWithSoul, hash);
}
```

---

### Decision 2: Cron Job Injection → Gateway RPC (cron.add)

**Decision**: Use Gateway WebSocket RPC for cron job management.

**Rationale**:
- OpenClaw Gateway exposes cron RPCs: `cron.add`, `cron.list`, `cron.update`, `cron.remove`, `cron.run`
- Verified via [`src/gateway/protocol/schema/cron.ts`](https://github.com/openclaw/openclaw/tree/main/src/gateway/protocol/schema)
- Same WebSocket connection used for config — no additional infrastructure
- No container exec needed
- Works universally across all deployment targets

**RPC Schema** (based on OpenClaw docs):
```typescript
// cron.add request
{
  method: 'cron.add',
  params: {
    name: string,
    schedule: CronSchedule,
    sessionTarget: 'main' | 'isolated',
    payload: {
      kind: 'systemEvent' | 'agentTurn',
      message: string,
      timeoutSeconds?: number,
      deliver?: boolean,
      channel?: string,
      to?: string,
    }
  }
}

// cron.add response
{
  jobId: string,
  created: boolean,
}
```

**Implementation Change**: Update `CronInjectorService`:

```typescript
// apps/api/src/templates/persona/cron-injector.service.ts

@Injectable()
export class CronInjectorService implements ICronInjector {
  constructor(private readonly gatewayClient: GatewayClientService) {}

  async addJob(instanceId: string, job: CronJobTemplate): Promise<string> {
    const response = await this.gatewayClient.rpc(instanceId, 'cron.add', {
      name: job.name,
      schedule: job.schedule,
      sessionTarget: job.sessionTarget,
      payload: job.payload,
      enabled: job.enabled,
    });

    return response.jobId;
  }

  async removeJob(instanceId: string, jobId: string): Promise<void> {
    await this.gatewayClient.rpc(instanceId, 'cron.remove', { jobId });
  }

  async listJobs(instanceId: string): Promise<CronJob[]> {
    const response = await this.gatewayClient.rpc(instanceId, 'cron.list', {});
    return response.jobs;
  }
}
```

---

### Decision 3: Template Versioning → Immutable Templates, New Bots for Updates

**Decision**: Templates are **immutable once installed**. Updates mean creating new bots.

**Rationale**:
- Simplest mental model for users
- No migration complexity
- No risk of breaking existing running bots
- Users have full control over when/if to upgrade
- Aligns with infrastructure-as-code principles (immutable deployments)

**User Flow**:
1. User creates bot with `marketer-v1.0.0`
2. Clawster releases `marketer-v2.0.0` with new features
3. User sees "New version available" badge in dashboard
4. User can:
   - Keep running v1.0.0 (no action needed)
   - Create **new** bot with v2.0.0
   - Optionally migrate workload and delete old bot

**Implementation**:
- `PersonaTemplate.version` is part of the unique identifier
- Dashboard shows `templateVersion` installed on each bot
- No automatic in-place upgrades
- Optional: "Clone with new template" feature for easier migration

**Schema**: Templates use semantic versioning in the ID:
```typescript
// Builtin templates
{ id: 'builtin/marketer', version: '1.0.0' }
{ id: 'builtin/marketer', version: '2.0.0' }

// Community templates
{ id: 'community/marketing-maven-pro', version: '2.1.0' }
```

---

### Decision 4: Template Marketplace → Phased Approach (Builtin → GitHub → Future Marketplace)

**Decision**: No existing template registry exists. Build progressively:

| Phase | Approach | Timeline |
|-------|----------|----------|
| **MVP** | Builtin templates only (ship with Clawster) | Week 1-2 |
| **V2** | GitHub-based discovery (`clawster-template` topic) | Week 3-4 |
| **Future** | Full marketplace site (if demand warrants) | TBD |

**Rationale**:
- ClawHub is **skills-only** — no templates
- Building a full marketplace is high effort with uncertain demand
- GitHub-based approach:
  - Zero infrastructure to build
  - Community self-organizes
  - Templates are just JSON + markdown (easy to host)
  - Discovery via GitHub topics/search
  - Familiar workflow for developers

**GitHub-Based Discovery Flow**:
```
1. Community member creates repo: github.com/user/my-sales-bot-template
2. Adds topic: "clawster-template"
3. Adds template.yaml manifest (see Section 8.1)
4. Clawster users can:
   - Browse github.com/topics/clawster-template
   - Import via: POST /persona-templates/import { url: "https://github.com/user/my-sales-bot-template" }
5. Template is fetched, validated, stored locally
```

**API Endpoint**:
```typescript
@Post('import')
@ApiOperation({ summary: 'Import a community template from GitHub' })
async importTemplate(
  @Body() dto: ImportTemplateDto,
): Promise<PersonaTemplateResponse> {
  return this.importService.importFromGitHub(dto.url);
}

class ImportTemplateDto {
  @IsUrl()
  url: string; // e.g., "https://github.com/clawster-templates/sales-assistant"
}
```

**Future Marketplace (if needed)**:
- Separate site: `templates.clawster.io`
- Features: ratings, reviews, verified publishers, featured templates
- Only build if GitHub-based approach shows strong adoption

---

## Summary: The "Magic" Experience

With these decisions, the user experience is:

1. **Wizard Step 1**: User selects deployment target (Docker/ECS/GCE/Azure)
2. **Wizard Step 2**: User browses template gallery, picks "Marketer"
3. **Wizard Step 3**: User provides required secrets (Buffer API key, etc.)
4. **Wizard Step 4**: User clicks "Deploy"
5. **Behind the scenes**:
   - Clawster provisions infrastructure (existing flow)
   - Clawster connects to Gateway via WebSocket
   - Clawster calls `config.apply` with identity + soul + skills + config patches
   - Clawster calls `cron.add` for each scheduled job
   - Clawster stores secrets in the appropriate vault (AWS/GCP/Azure/local)
6. **Result**: Fully configured marketing bot is RUNNING with personality, skills, and scheduled jobs

**Zero platform-specific code in the template injection path** — everything goes through Gateway RPC, which works identically everywhere.
