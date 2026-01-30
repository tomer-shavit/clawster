import { z } from "zod";
import { envString } from "../openclaw-config";

// =============================================================================
// Model API Types — matches OpenClaw's supported API protocols
// =============================================================================

export const ModelApiSchema = z.enum([
  "openai-completions",
  "openai-responses",
  "anthropic-messages",
  "google-generative-ai",
  "github-copilot",
  "bedrock-converse-stream",
]);
export type ModelApi = z.infer<typeof ModelApiSchema>;

// =============================================================================
// Model Provider Config — matches OpenClaw's ModelProviderConfig shape
// =============================================================================

export const ModelProviderConfigSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: envString.optional(),
  auth: z.enum(["api_key", "oauth", "token"]).default("api_key"),
  api: ModelApiSchema.default("anthropic-messages"),
  headers: z.record(z.string()).optional(),
  models: z.array(z.string()).optional(),
});
export type ModelProviderConfig = z.infer<typeof ModelProviderConfigSchema>;

// =============================================================================
// Models Config Section — top-level config section for OpenClawConfigSchema
// =============================================================================

export const ModelsConfigSchema = z.object({
  providers: z.record(z.string(), ModelProviderConfigSchema).optional(),
});
export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;

// =============================================================================
// AI Gateway Settings — stored on BotInstance DB, NOT in openclaw.json
// =============================================================================

export const AiGatewaySettingsSchema = z.object({
  enabled: z.boolean().default(false),
  providerName: z.string().min(1).default("vercel-ai-gateway"),
  gatewayUrl: z.string().url().optional(),
  gatewayApiKey: z.string().min(1).optional(),
  api: ModelApiSchema.default("anthropic-messages"),
});
export type AiGatewaySettings = z.infer<typeof AiGatewaySettingsSchema>;
