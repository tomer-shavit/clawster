/**
 * Persona Template types.
 * Types for managing bot personality templates that can be injected into running instances.
 */

// =============================================================================
// Identity
// =============================================================================

export interface PersonaIdentity {
  name: string;
  emoji?: string;
  creature?: string;
  vibe?: string;
  theme?: string;
  avatar?: string;
}

// =============================================================================
// Cron Job
// =============================================================================

export interface CronSchedule {
  kind: "at" | "every" | "cron";
  at?: string;
  everyMs?: number;
  expr?: string;
  tz?: string;
}

export interface CronPayload {
  kind: "systemEvent" | "agentTurn";
  text?: string;
  message?: string;
  model?: string;
}

export interface PersonaCronJob {
  name: string;
  description?: string;
  schedule: CronSchedule;
  payload: CronPayload;
  enabled?: boolean;
}

// =============================================================================
// Required Secret
// =============================================================================

export interface PersonaRequiredSecret {
  key: string;
  label: string;
  description?: string;
  configPath: string;
}

// =============================================================================
// Persona Template
// =============================================================================

export type PersonaTemplateCategory =
  | "marketing"
  | "devops"
  | "support"
  | "assistant"
  | "research"
  | "creative"
  | "custom";

export interface PersonaTemplate {
  id: string;
  version: string;
  name: string;
  description: string;
  category: PersonaTemplateCategory;
  tags: string[];
  identity?: PersonaIdentity;
  soul?: string;
  skills: string[];
  cronJobs: PersonaCronJob[];
  configPatches?: Record<string, unknown>;
  requiredSecrets: PersonaRequiredSecret[];
  isBuiltin: boolean;
  workspaceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// =============================================================================
// Payloads
// =============================================================================

export interface CreatePersonaTemplatePayload {
  name: string;
  description: string;
  category: PersonaTemplateCategory;
  tags?: string[];
  identity?: PersonaIdentity;
  soul?: string;
  skills?: string[];
  cronJobs?: PersonaCronJob[];
  configPatches?: Record<string, unknown>;
  requiredSecrets?: PersonaRequiredSecret[];
}

export interface InjectTemplatePayload {
  secrets?: Record<string, string>;
}

// =============================================================================
// Response Types
// =============================================================================

export interface InjectionResult {
  success: boolean;
  snapshotId?: string;
  cronJobIds: string[];
  error?: string;
}

export interface RollbackResult {
  success: boolean;
  error?: string;
}

export type InjectionStatus =
  | "none"
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "rolled_back";

export interface InjectionStatusResponse {
  instanceId: string;
  templateId?: string;
  templateVersion?: string;
  status: InjectionStatus;
  snapshotId?: string;
  injectedAt?: string;
  cronJobCount: number;
}
