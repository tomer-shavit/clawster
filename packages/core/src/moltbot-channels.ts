import { z } from "zod";

// =============================================================================
// Common Channel Enums & Shared Schemas
// =============================================================================

export const DmPolicySchema = z.enum([
  "pairing",
  "allowlist",
  "open",
  "disabled",
]);
export type DmPolicy = z.infer<typeof DmPolicySchema>;

export const GroupPolicySchema = z.enum([
  "allowlist",
  "open",
  "disabled",
]);
export type GroupPolicy = z.infer<typeof GroupPolicySchema>;

export const ChannelTypeSchema = z.enum([
  "whatsapp",
  "telegram",
  "discord",
  "slack",
  "signal",
  "imessage",
  "mattermost",
  "google-chat",
  "ms-teams",
  "line",
  "matrix",
]);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

/** Fields common to every channel block. */
const BaseChannelFields = {
  enabled: z.boolean().default(true),
  dmPolicy: DmPolicySchema.default("pairing"),
  groupPolicy: GroupPolicySchema.default("disabled"),
  allowFrom: z.array(z.string()).optional(),
  groupAllowFrom: z.array(z.string()).optional(),
  historyLimit: z.number().int().min(0).default(50),
  mediaMaxMb: z.number().min(0).default(25),
};

// =============================================================================
// Per-Channel Schemas (discriminated by `type`)
// =============================================================================

export const WhatsAppChannelSchema = z.object({
  type: z.literal("whatsapp"),
  ...BaseChannelFields,
  sendReadReceipts: z.boolean().default(false),
  chunkMode: z.enum(["length", "newline"]).default("length"),
});
export type WhatsAppChannel = z.infer<typeof WhatsAppChannelSchema>;

export const TelegramChannelSchema = z.object({
  type: z.literal("telegram"),
  ...BaseChannelFields,
  botToken: z.string().optional(),
  tokenFile: z.string().optional(),
  linkPreview: z.boolean().default(false),
  streamMode: z.enum(["off", "partial", "block"]).default("off"),
  customCommands: z.array(
    z.object({
      command: z.string(),
      description: z.string().optional(),
    }),
  ).optional(),
});
export type TelegramChannel = z.infer<typeof TelegramChannelSchema>;

export const DiscordChannelSchema = z.object({
  type: z.literal("discord"),
  ...BaseChannelFields,
  token: z.string().optional(),
  allowBots: z.boolean().default(false),
  guilds: z.record(
    z.string(),
    z.object({
      slug: z.string().optional(),
    }),
  ).optional(),
  replyToMode: z.enum(["off", "first", "all"]).default("first"),
});
export type DiscordChannel = z.infer<typeof DiscordChannelSchema>;

export const SlackChannelSchema = z.object({
  type: z.literal("slack"),
  ...BaseChannelFields,
  botToken: z.string().optional(),
  appToken: z.string().optional(),
  slashCommand: z
    .object({
      enabled: z.boolean().default(false),
      command: z.string().default("/moltbot"),
    })
    .optional(),
  thread: z
    .object({
      historyScope: z.enum(["thread", "channel"]).default("thread"),
    })
    .optional(),
});
export type SlackChannel = z.infer<typeof SlackChannelSchema>;

export const SignalChannelSchema = z.object({
  type: z.literal("signal"),
  ...BaseChannelFields,
});
export type SignalChannel = z.infer<typeof SignalChannelSchema>;

export const IMessageChannelSchema = z.object({
  type: z.literal("imessage"),
  ...BaseChannelFields,
});
export type IMessageChannel = z.infer<typeof IMessageChannelSchema>;

export const MattermostChannelSchema = z.object({
  type: z.literal("mattermost"),
  ...BaseChannelFields,
  serverUrl: z.string().url().optional(),
  token: z.string().optional(),
});
export type MattermostChannel = z.infer<typeof MattermostChannelSchema>;

export const GoogleChatChannelSchema = z.object({
  type: z.literal("google-chat"),
  ...BaseChannelFields,
  serviceAccountKeyFile: z.string().optional(),
});
export type GoogleChatChannel = z.infer<typeof GoogleChatChannelSchema>;

export const MSTeamsChannelSchema = z.object({
  type: z.literal("ms-teams"),
  ...BaseChannelFields,
  appId: z.string().optional(),
  appPassword: z.string().optional(),
});
export type MSTeamsChannel = z.infer<typeof MSTeamsChannelSchema>;

export const LINEChannelSchema = z.object({
  type: z.literal("line"),
  ...BaseChannelFields,
  channelAccessToken: z.string().optional(),
  channelSecret: z.string().optional(),
});
export type LINEChannel = z.infer<typeof LINEChannelSchema>;

export const MatrixChannelSchema = z.object({
  type: z.literal("matrix"),
  ...BaseChannelFields,
  homeserverUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
});
export type MatrixChannel = z.infer<typeof MatrixChannelSchema>;

// =============================================================================
// Discriminated Union of All Channel Types
// =============================================================================

export const MoltbotChannelSchema = z.discriminatedUnion("type", [
  WhatsAppChannelSchema,
  TelegramChannelSchema,
  DiscordChannelSchema,
  SlackChannelSchema,
  SignalChannelSchema,
  IMessageChannelSchema,
  MattermostChannelSchema,
  GoogleChatChannelSchema,
  MSTeamsChannelSchema,
  LINEChannelSchema,
  MatrixChannelSchema,
]);
export type MoltbotChannel = z.infer<typeof MoltbotChannelSchema>;

/**
 * Record keyed by channel type for the top-level `channels` config block.
 * Each key is optional; only configured channels need to appear.
 */
export const ChannelsConfigSchema = z.object({
  whatsapp: WhatsAppChannelSchema.omit({ type: true }).optional(),
  telegram: TelegramChannelSchema.omit({ type: true }).optional(),
  discord: DiscordChannelSchema.omit({ type: true }).optional(),
  slack: SlackChannelSchema.omit({ type: true }).optional(),
  signal: SignalChannelSchema.omit({ type: true }).optional(),
  imessage: IMessageChannelSchema.omit({ type: true }).optional(),
  mattermost: MattermostChannelSchema.omit({ type: true }).optional(),
  "google-chat": GoogleChatChannelSchema.omit({ type: true }).optional(),
  "ms-teams": MSTeamsChannelSchema.omit({ type: true }).optional(),
  line: LINEChannelSchema.omit({ type: true }).optional(),
  matrix: MatrixChannelSchema.omit({ type: true }).optional(),
}).optional();
export type ChannelsConfig = z.infer<typeof ChannelsConfigSchema>;
