import { z } from "zod";
import { ChannelsConfigSchema, ChannelTypeSchema } from "./moltbot-channels";

// =============================================================================
// Shared Primitives
// =============================================================================

/**
 * Environment variable substitution pattern: ${VAR_NAME}
 * Values that support env-var interpolation accept either a plain string
 * or a string containing one or more `${…}` references.
 */
export const EnvSubstitutionPattern = /\$\{[A-Za-z_][A-Za-z0-9_]*\}/;

/** String that may contain `${VAR}` env-var references. */
export const envString = z.string();

// =============================================================================
// Tool Groups
// =============================================================================

export const ToolGroupSchema = z.enum([
  "group:runtime",
  "group:fs",
  "group:sessions",
  "group:memory",
  "group:web",
  "group:ui",
  "group:automation",
  "group:messaging",
  "group:nodes",
  "group:moltbot",
]);
export type ToolGroup = z.infer<typeof ToolGroupSchema>;

/** A tool reference is either a named tool or a group alias. */
export const ToolRefSchema = z.string().min(1);

// =============================================================================
// Sandbox Config
// =============================================================================

export const SandboxModeSchema = z.enum(["off", "non-main", "all"]);
export type SandboxMode = z.infer<typeof SandboxModeSchema>;

export const SandboxScopeSchema = z.enum(["session", "agent", "shared"]);
export type SandboxScope = z.infer<typeof SandboxScopeSchema>;

export const WorkspaceAccessSchema = z.enum(["none", "ro", "rw"]);
export type WorkspaceAccess = z.infer<typeof WorkspaceAccessSchema>;

export const DockerSandboxSchema = z.object({
  image: z.string().optional(),
  network: z.string().optional(),
  memory: z.string().optional(),
  cpus: z.number().positive().optional(),
});
export type DockerSandbox = z.infer<typeof DockerSandboxSchema>;

export const SandboxConfigSchema = z.object({
  mode: SandboxModeSchema.default("off"),
  scope: SandboxScopeSchema.default("session"),
  workspaceAccess: WorkspaceAccessSchema.default("rw"),
  docker: DockerSandboxSchema.optional(),
});
export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;

// =============================================================================
// Model Config
// =============================================================================

/** provider/model format, e.g. "anthropic/claude-sonnet-4-20250514" */
export const ModelRefSchema = z.string().min(1);

export const ModelConfigSchema = z.object({
  primary: ModelRefSchema,
  fallbacks: z.array(ModelRefSchema).optional(),
});
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

// =============================================================================
// Agent Identity
// =============================================================================

export const AgentIdentitySchema = z.object({
  name: z.string().min(1).optional(),
  emoji: z.string().optional(),
  theme: z.string().optional(),
  avatar: z.string().optional(),
});
export type AgentIdentity = z.infer<typeof AgentIdentitySchema>;

// =============================================================================
// Agent Defaults & Agent List
// =============================================================================

export const ThinkingDefaultSchema = z.enum(["low", "high", "off"]);
export type ThinkingDefault = z.infer<typeof ThinkingDefaultSchema>;

export const AgentDefaultsSchema = z.object({
  workspace: z.string().default("~/clawd"),
  model: ModelConfigSchema.optional(),
  thinkingDefault: ThinkingDefaultSchema.default("off"),
  timeoutSeconds: z.number().int().positive().default(600),
  maxConcurrent: z.number().int().positive().optional(),
  sandbox: SandboxConfigSchema.optional(),
});
export type AgentDefaults = z.infer<typeof AgentDefaultsSchema>;

export const AgentEntrySchema = z.object({
  id: z.string().min(1),
  default: z.boolean().optional(),
  workspace: z.string().optional(),
  agentDir: z.string().optional(),
  identity: AgentIdentitySchema.optional(),
  model: ModelConfigSchema.optional(),
  sandbox: SandboxConfigSchema.optional(),
  tools: z
    .object({
      allow: z.array(ToolRefSchema).optional(),
      deny: z.array(ToolRefSchema).optional(),
    })
    .optional(),
});
export type AgentEntry = z.infer<typeof AgentEntrySchema>;

export const AgentsConfigSchema = z.object({
  defaults: AgentDefaultsSchema.optional(),
  list: z.array(AgentEntrySchema).optional(),
});
export type AgentsConfig = z.infer<typeof AgentsConfigSchema>;

// =============================================================================
// Session Config
// =============================================================================

export const SessionScopeSchema = z.enum(["per-sender", "per-channel-peer"]);
export type SessionScope = z.infer<typeof SessionScopeSchema>;

export const SessionResetModeSchema = z.enum(["daily", "idle"]);
export type SessionResetMode = z.infer<typeof SessionResetModeSchema>;

export const SessionConfigSchema = z.object({
  scope: SessionScopeSchema.default("per-sender"),
  reset: z
    .object({
      mode: SessionResetModeSchema.default("daily"),
    })
    .optional(),
  resetTriggers: z.array(z.string()).default(["/new", "/reset"]),
});
export type SessionConfig = z.infer<typeof SessionConfigSchema>;

// =============================================================================
// Messages Config
// =============================================================================

export const QueueModeSchema = z.enum([
  "steer",
  "collect",
  "followup",
  "interrupt",
]);
export type QueueMode = z.infer<typeof QueueModeSchema>;

export const MessagesConfigSchema = z.object({
  responsePrefix: z.string().optional(),
  ackReaction: z.string().optional(),
  queue: z
    .object({
      mode: QueueModeSchema.default("steer"),
    })
    .optional(),
  tts: z
    .object({
      enabled: z.boolean().default(false),
      voice: z.string().optional(),
    })
    .optional(),
});
export type MessagesConfig = z.infer<typeof MessagesConfigSchema>;

// =============================================================================
// Tools Config
// =============================================================================

export const ToolProfileSchema = z.enum([
  "minimal",
  "coding",
  "messaging",
  "full",
]);
export type ToolProfile = z.infer<typeof ToolProfileSchema>;

export const ToolsExecSchema = z.object({
  backgroundMs: z.number().int().positive().default(10_000),
  timeoutSec: z.number().int().positive().default(1800),
});
export type ToolsExec = z.infer<typeof ToolsExecSchema>;

export const ToolsConfigSchema = z.object({
  profile: ToolProfileSchema.default("coding"),
  allow: z.array(ToolRefSchema).optional(),
  deny: z.array(ToolRefSchema).optional(),
  elevated: z
    .object({
      enabled: z.boolean().default(false),
      allowFrom: z.array(z.string()).optional(),
    })
    .optional(),
  exec: ToolsExecSchema.optional(),
});
export type ToolsConfig = z.infer<typeof ToolsConfigSchema>;

// =============================================================================
// Skills Config
// =============================================================================

export const SkillEntrySchema = z.object({
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().default(true),
  env: z.record(z.string()).optional(),
  apiKey: z.string().optional(),
});
export type SkillEntry = z.infer<typeof SkillEntrySchema>;

export const SkillsConfigSchema = z.object({
  allowBundled: z.array(z.string()).optional(),
  load: z
    .object({
      extraDirs: z.array(z.string()).optional(),
    })
    .optional(),
  entries: z.record(z.string(), SkillEntrySchema).optional(),
});
export type SkillsConfig = z.infer<typeof SkillsConfigSchema>;

// =============================================================================
// Plugins Config
// =============================================================================

export const PluginEntrySchema = z.object({
  config: z.record(z.unknown()).optional(),
});
export type PluginEntry = z.infer<typeof PluginEntrySchema>;

export const PluginsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  allow: z.array(z.string()).optional(),
  deny: z.array(z.string()).optional(),
  entries: z.record(z.string(), PluginEntrySchema).optional(),
});
export type PluginsConfig = z.infer<typeof PluginsConfigSchema>;

// =============================================================================
// Gateway Config
// =============================================================================

export const GatewayAuthSchema = z.object({
  token: z.string().optional(),
  password: z.string().optional(),
});
export type GatewayAuth = z.infer<typeof GatewayAuthSchema>;

export const GatewayConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(18789),
  auth: GatewayAuthSchema.optional(),
  host: z.string().default("127.0.0.1"),
});
export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;

// =============================================================================
// Logging Config
// =============================================================================

export const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const RedactSensitiveSchema = z.enum(["off", "tools"]);
export type RedactSensitive = z.infer<typeof RedactSensitiveSchema>;

export const LoggingConfigSchema = z.object({
  level: LogLevelSchema.default("info"),
  file: z.string().optional(),
  redactSensitive: RedactSensitiveSchema.default("off"),
});
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

// =============================================================================
// Bindings (Multi-Agent Routing)
// =============================================================================

export const PeerKindSchema = z.enum(["dm", "group", "channel"]);
export type PeerKind = z.infer<typeof PeerKindSchema>;

export const BindingMatchSchema = z.object({
  channel: ChannelTypeSchema.optional(),
  peer: z
    .object({
      kind: PeerKindSchema,
      id: z.string().min(1),
    })
    .optional(),
});
export type BindingMatch = z.infer<typeof BindingMatchSchema>;

export const BindingEntrySchema = z.object({
  agentId: z.string().min(1),
  match: BindingMatchSchema,
});
export type BindingEntry = z.infer<typeof BindingEntrySchema>;

// =============================================================================
// $include Directive (recursive config inclusion)
// =============================================================================

/** Supports lazy recursive references for $include directives. */
export const IncludeDirectiveSchema = z.object({
  $include: z.string().min(1),
});
export type IncludeDirective = z.infer<typeof IncludeDirectiveSchema>;

// =============================================================================
// Config RPC Types
// =============================================================================

export const ConfigGetResponseSchema = z.object({
  config: z.record(z.unknown()),
  hash: z.string(),
});
export type ConfigGetResponse = z.infer<typeof ConfigGetResponseSchema>;

export const ConfigApplyRequestSchema = z.object({
  raw: z.string().min(1),
  baseHash: z.string().optional(),
  sessionKey: z.string().optional(),
  restartDelayMs: z.number().int().min(0).optional(),
});
export type ConfigApplyRequest = z.infer<typeof ConfigApplyRequestSchema>;

export const ConfigPatchRequestSchema = z.object({
  patch: z.record(z.unknown()),
  baseHash: z.string().optional(),
  sessionKey: z.string().optional(),
  restartDelayMs: z.number().int().min(0).optional(),
});
export type ConfigPatchRequest = z.infer<typeof ConfigPatchRequestSchema>;

// =============================================================================
// Full Moltbot Config Schema
// =============================================================================

export const MoltbotConfigSchema = z.object({
  /** Optional $include for splitting config across files. */
  $include: z.union([z.string(), z.array(z.string())]).optional(),

  agents: AgentsConfigSchema.optional(),
  session: SessionConfigSchema.optional(),
  messages: MessagesConfigSchema.optional(),
  channels: ChannelsConfigSchema,
  tools: ToolsConfigSchema.optional(),
  sandbox: SandboxConfigSchema.optional(),
  skills: SkillsConfigSchema.optional(),
  plugins: PluginsConfigSchema.optional(),
  gateway: GatewayConfigSchema.optional(),
  logging: LoggingConfigSchema.optional(),
  bindings: z.array(BindingEntrySchema).optional(),
});
/**
 * Full validated Moltbot config type inferred from the Zod schema.
 *
 * Named `MoltbotFullConfig` to avoid collision with the lightweight
 * `MoltbotConfig` interface in `moltbot-policies.ts` (used for policy
 * evaluation).
 */
export type MoltbotFullConfig = z.infer<typeof MoltbotConfigSchema>;

/**
 * Parse & validate a raw config object (e.g. from JSON5) against the
 * full Moltbot config schema.
 */
export function validateMoltbotConfig(data: unknown): MoltbotFullConfig {
  return MoltbotConfigSchema.parse(data);
}
