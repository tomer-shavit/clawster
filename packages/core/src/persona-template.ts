import { z } from "zod";

// =============================================================================
// Identity Configuration
// =============================================================================

/**
 * Bot identity configuration for visual representation.
 * Maps to OpenClaw's agents.list[].identity structure.
 */
export const IdentityConfigSchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().max(10).optional(),
  creature: z.string().max(50).optional(),
  vibe: z.string().max(200).optional(),
  theme: z.string().max(50).optional(),
  avatar: z.string().optional(), // URL, data URI, or workspace-relative path
});
export type IdentityConfig = z.infer<typeof IdentityConfigSchema>;

// =============================================================================
// Cron Schedule Schemas (matches OpenClaw's cron.ts)
// =============================================================================

/**
 * One-time execution at a specific time.
 */
export const CronScheduleAtSchema = z.object({
  kind: z.literal("at"),
  at: z.string(), // ISO timestamp or relative time
});

/**
 * Interval-based execution.
 */
export const CronScheduleEverySchema = z.object({
  kind: z.literal("every"),
  everyMs: z.number().int().min(1), // Interval in milliseconds
  anchorMs: z.number().int().min(0).optional(), // Optional anchor time
});

/**
 * Cron expression based execution.
 */
export const CronScheduleCronSchema = z.object({
  kind: z.literal("cron"),
  expr: z.string().min(1), // Standard cron expression
  tz: z.string().optional(), // Timezone (e.g., "America/New_York")
});

export const CronScheduleSchema = z.discriminatedUnion("kind", [
  CronScheduleAtSchema,
  CronScheduleEverySchema,
  CronScheduleCronSchema,
]);
export type CronSchedule = z.infer<typeof CronScheduleSchema>;

// =============================================================================
// Cron Payload Schemas (matches OpenClaw's cron.ts)
// =============================================================================

/**
 * System event payload - triggers a system event without agent invocation.
 */
export const CronPayloadSystemEventSchema = z.object({
  kind: z.literal("systemEvent"),
  text: z.string().min(1),
});

/**
 * Agent turn payload - invokes the agent with a message.
 */
export const CronPayloadAgentTurnSchema = z.object({
  kind: z.literal("agentTurn"),
  message: z.string().min(1),
  model: z.string().optional(),
  thinking: z.string().optional(),
  timeoutSeconds: z.number().int().min(1).optional(),
});

export const CronPayloadSchema = z.discriminatedUnion("kind", [
  CronPayloadSystemEventSchema,
  CronPayloadAgentTurnSchema,
]);
export type CronPayload = z.infer<typeof CronPayloadSchema>;

// =============================================================================
// Cron Job Template
// =============================================================================

/**
 * Cron delivery configuration - where to send results.
 */
export const CronDeliverySchema = z.object({
  channel: z.string().optional(),
  to: z.string().optional(),
});
export type CronDelivery = z.infer<typeof CronDeliverySchema>;

/**
 * Full cron job template for persona templates.
 */
export const CronJobTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  schedule: CronScheduleSchema,
  payload: CronPayloadSchema,
  enabled: z.boolean().default(true),
  deleteAfterRun: z.boolean().optional(),
  sessionTarget: z.enum(["main", "isolated"]).default("main"),
  wakeMode: z.enum(["next-heartbeat", "now"]).default("next-heartbeat"),
  delivery: CronDeliverySchema.optional(),
});
export type CronJobTemplate = z.infer<typeof CronJobTemplateSchema>;

// =============================================================================
// Required Secret Reference
// =============================================================================

/**
 * Secret required by a persona template.
 * The actual secret value is provided during injection.
 */
export const RequiredSecretSchema = z.object({
  key: z.string().min(1), // Identifier for the secret
  label: z.string().min(1), // Human-readable label
  description: z.string().max(500).optional(),
  configPath: z.string().min(1), // Dot-separated path in config to inject
  envVar: z.string().optional(), // Environment variable name for local deployment
});
export type RequiredSecret = z.infer<typeof RequiredSecretSchema>;

// =============================================================================
// Persona Template Schema
// =============================================================================

export const PersonaTemplateCategorySchema = z.enum([
  "marketing",
  "devops",
  "support",
  "assistant",
  "research",
  "creative",
  "custom",
]);
export type PersonaTemplateCategory = z.infer<typeof PersonaTemplateCategorySchema>;

/**
 * Complete Persona Template schema.
 * Bundles identity, personality, skills, cron jobs, and configuration
 * into a reusable bot archetype.
 */
export const PersonaTemplateSchema = z.object({
  // Metadata
  id: z.string().min(1), // e.g., "builtin/marketer" or "custom/my-bot"
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver format"),
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  category: PersonaTemplateCategorySchema,
  tags: z.array(z.string()).default([]),

  // Identity configuration (injected via config.apply)
  identity: IdentityConfigSchema.optional(),

  // Soul/personality content (requires file write to SOUL.md)
  soul: z.string().max(50000).optional(),

  // Skills to enable
  skills: z.array(z.string()).default([]),

  // Scheduled jobs
  cronJobs: z.array(CronJobTemplateSchema).default([]),

  // Config patches to apply via config.apply
  configPatches: z.record(z.unknown()).optional(),

  // Required secrets
  requiredSecrets: z.array(RequiredSecretSchema).default([]),

  // Template scope
  isBuiltin: z.boolean().default(false),
  workspaceId: z.string().optional(), // null = global template

  // Timestamps
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type PersonaTemplate = z.infer<typeof PersonaTemplateSchema>;

// =============================================================================
// Template Injection Snapshot (for rollback)
// =============================================================================

/**
 * Snapshot of bot state before template injection.
 * Used for rollback if injection fails or is reverted.
 */
export const TemplateInjectionSnapshotSchema = z.object({
  id: z.string(),
  instanceId: z.string(),
  templateId: z.string(),
  templateVersion: z.string(),

  // Pre-injection state
  configHash: z.string(), // Hash of config before injection
  configRaw: z.string(), // Full config JSON before injection

  // Created cron job IDs (for removal on rollback)
  cronJobIds: z.array(z.string()).default([]),

  injectedAt: z.date(),
});
export type TemplateInjectionSnapshot = z.infer<typeof TemplateInjectionSnapshotSchema>;

// =============================================================================
// Injection Status
// =============================================================================

export const InjectionStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
  "rolled_back",
]);
export type InjectionStatus = z.infer<typeof InjectionStatusSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

export function validatePersonaTemplate(data: unknown): PersonaTemplate {
  return PersonaTemplateSchema.parse(data);
}

export function validateCronJobTemplate(data: unknown): CronJobTemplate {
  return CronJobTemplateSchema.parse(data);
}

export function validateIdentityConfig(data: unknown): IdentityConfig {
  return IdentityConfigSchema.parse(data);
}
