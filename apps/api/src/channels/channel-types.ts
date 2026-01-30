// ============================================
// OpenClaw Channel Types & Configuration
// ============================================

export const OPENCLAW_CHANNEL_TYPES = [
  'whatsapp', 'telegram', 'discord', 'slack', 'signal',
  'imessage', 'mattermost', 'google-chat', 'ms-teams', 'line', 'matrix',
] as const;

export type OpenClawChannelType = typeof OPENCLAW_CHANNEL_TYPES[number];

/** Channels that require Node.js runtime (Bun not supported) */
export const NODE_REQUIRED_CHANNELS: OpenClawChannelType[] = ['whatsapp', 'telegram'];

/** Channels that support QR-based pairing */
export const QR_PAIRING_CHANNELS: OpenClawChannelType[] = ['whatsapp'];

// ============================================
// Policy Types
// ============================================

export type DmPolicy = 'pairing' | 'allowlist' | 'open' | 'disabled';
export type GroupPolicy = 'allowlist' | 'open' | 'disabled';
export type ChannelAuthState = 'pending' | 'pairing' | 'paired' | 'expired' | 'error';

export const DM_POLICIES: DmPolicy[] = ['pairing', 'allowlist', 'open', 'disabled'];
export const GROUP_POLICIES: GroupPolicy[] = ['allowlist', 'open', 'disabled'];
export const AUTH_STATES: ChannelAuthState[] = ['pending', 'pairing', 'paired', 'expired', 'error'];

// ============================================
// Common Channel Configuration
// ============================================

export interface CommonChannelConfig {
  enabled: boolean;
  dmPolicy: DmPolicy;
  groupPolicy: GroupPolicy;
  allowFrom: string[];
  groupAllowFrom: string[];
  historyLimit: number;
  mediaMaxMb: number;
}

export const DEFAULT_COMMON_CONFIG: CommonChannelConfig = {
  enabled: true,
  dmPolicy: 'pairing',
  groupPolicy: 'allowlist',
  allowFrom: [],
  groupAllowFrom: [],
  historyLimit: 50,
  mediaMaxMb: 25,
};

// ============================================
// Per-Type Channel Configurations
// ============================================

export type WhatsAppChunkMode = 'length' | 'newline';

export interface WhatsAppConfig extends CommonChannelConfig {
  sendReadReceipts: boolean;
  chunkMode: WhatsAppChunkMode;
}

export const DEFAULT_WHATSAPP_CONFIG: Omit<WhatsAppConfig, keyof CommonChannelConfig> = {
  sendReadReceipts: true,
  chunkMode: 'length',
};

export type TelegramStreamMode = 'off' | 'partial' | 'block';

export interface TelegramConfig extends CommonChannelConfig {
  botToken?: string;
  tokenFile?: string;
  linkPreview: boolean;
  streamMode: TelegramStreamMode;
  customCommands: Record<string, string>;
}

export const DEFAULT_TELEGRAM_CONFIG: Omit<TelegramConfig, keyof CommonChannelConfig> = {
  linkPreview: true,
  streamMode: 'off',
  customCommands: {},
};

export type DiscordReplyToMode = 'off' | 'first' | 'all';

export interface DiscordConfig extends CommonChannelConfig {
  token?: string;
  allowBots: boolean;
  guilds: Record<string, { slug: string }>;
  replyToMode: DiscordReplyToMode;
}

export const DEFAULT_DISCORD_CONFIG: Omit<DiscordConfig, keyof CommonChannelConfig> = {
  allowBots: false,
  guilds: {},
  replyToMode: 'off',
};

export type SlackThreadHistoryScope = 'thread' | 'channel';

export interface SlackConfig extends CommonChannelConfig {
  botToken?: string;
  appToken?: string;
  slashCommand: {
    enabled: boolean;
    name: string;
  };
  thread: {
    historyScope: SlackThreadHistoryScope;
  };
}

export const DEFAULT_SLACK_CONFIG: Omit<SlackConfig, keyof CommonChannelConfig> = {
  slashCommand: { enabled: false, name: '/openclaw' },
  thread: { historyScope: 'thread' },
};

export interface SignalConfig extends CommonChannelConfig {
  // Signal uses common dm/group policies + adapter config
  adapterConfig: Record<string, unknown>;
}

export const DEFAULT_SIGNAL_CONFIG: Omit<SignalConfig, keyof CommonChannelConfig> = {
  adapterConfig: {},
};

export interface IMessageConfig extends CommonChannelConfig {
  // macOS-only channel
  adapterConfig: Record<string, unknown>;
}

export const DEFAULT_IMESSAGE_CONFIG: Omit<IMessageConfig, keyof CommonChannelConfig> = {
  adapterConfig: {},
};

export interface MattermostConfig extends CommonChannelConfig {
  serverUrl?: string;
  token?: string;
}

export const DEFAULT_MATTERMOST_CONFIG: Omit<MattermostConfig, keyof CommonChannelConfig> = {};

export interface GoogleChatConfig extends CommonChannelConfig {
  serviceAccountJson?: string;
}

export const DEFAULT_GOOGLE_CHAT_CONFIG: Omit<GoogleChatConfig, keyof CommonChannelConfig> = {};

export interface MSTeamsConfig extends CommonChannelConfig {
  appId?: string;
  appPassword?: string;
  tenantId?: string;
}

export const DEFAULT_MS_TEAMS_CONFIG: Omit<MSTeamsConfig, keyof CommonChannelConfig> = {};

export interface LineConfig extends CommonChannelConfig {
  channelToken?: string;
  channelSecret?: string;
}

export const DEFAULT_LINE_CONFIG: Omit<LineConfig, keyof CommonChannelConfig> = {};

export interface MatrixConfig extends CommonChannelConfig {
  homeserverUrl?: string;
  accessToken?: string;
}

export const DEFAULT_MATRIX_CONFIG: Omit<MatrixConfig, keyof CommonChannelConfig> = {};

// ============================================
// Union type for all channel configs
// ============================================

export type OpenClawChannelConfig =
  | WhatsAppConfig
  | TelegramConfig
  | DiscordConfig
  | SlackConfig
  | SignalConfig
  | IMessageConfig
  | MattermostConfig
  | GoogleChatConfig
  | MSTeamsConfig
  | LineConfig
  | MatrixConfig;

// ============================================
// Channel type metadata
// ============================================

export interface ChannelTypeMeta {
  type: OpenClawChannelType;
  label: string;
  requiresNodeRuntime: boolean;
  authMethod: 'qr-pairing' | 'token' | 'credentials' | 'service-account';
  requiredSecrets: string[];
  optionalSecrets: string[];
  defaultConfig: Record<string, unknown>;
}

export const CHANNEL_TYPE_META: Record<OpenClawChannelType, ChannelTypeMeta> = {
  whatsapp: {
    type: 'whatsapp',
    label: 'WhatsApp',
    requiresNodeRuntime: true,
    authMethod: 'qr-pairing',
    requiredSecrets: [],
    optionalSecrets: [],
    defaultConfig: { ...DEFAULT_COMMON_CONFIG, ...DEFAULT_WHATSAPP_CONFIG },
  },
  telegram: {
    type: 'telegram',
    label: 'Telegram',
    requiresNodeRuntime: true,
    authMethod: 'token',
    requiredSecrets: ['botToken'],
    optionalSecrets: ['tokenFile'],
    defaultConfig: { ...DEFAULT_COMMON_CONFIG, ...DEFAULT_TELEGRAM_CONFIG },
  },
  discord: {
    type: 'discord',
    label: 'Discord',
    requiresNodeRuntime: false,
    authMethod: 'token',
    requiredSecrets: ['token'],
    optionalSecrets: [],
    defaultConfig: { ...DEFAULT_COMMON_CONFIG, ...DEFAULT_DISCORD_CONFIG },
  },
  slack: {
    type: 'slack',
    label: 'Slack',
    requiresNodeRuntime: false,
    authMethod: 'token',
    requiredSecrets: ['botToken', 'appToken'],
    optionalSecrets: [],
    defaultConfig: { ...DEFAULT_COMMON_CONFIG, ...DEFAULT_SLACK_CONFIG },
  },
  signal: {
    type: 'signal',
    label: 'Signal',
    requiresNodeRuntime: false,
    authMethod: 'credentials',
    requiredSecrets: [],
    optionalSecrets: [],
    defaultConfig: { ...DEFAULT_COMMON_CONFIG, ...DEFAULT_SIGNAL_CONFIG },
  },
  imessage: {
    type: 'imessage',
    label: 'iMessage',
    requiresNodeRuntime: false,
    authMethod: 'credentials',
    requiredSecrets: [],
    optionalSecrets: [],
    defaultConfig: { ...DEFAULT_COMMON_CONFIG, ...DEFAULT_IMESSAGE_CONFIG },
  },
  mattermost: {
    type: 'mattermost',
    label: 'Mattermost',
    requiresNodeRuntime: false,
    authMethod: 'token',
    requiredSecrets: ['token'],
    optionalSecrets: ['serverUrl'],
    defaultConfig: { ...DEFAULT_COMMON_CONFIG, ...DEFAULT_MATTERMOST_CONFIG },
  },
  'google-chat': {
    type: 'google-chat',
    label: 'Google Chat',
    requiresNodeRuntime: false,
    authMethod: 'service-account',
    requiredSecrets: ['serviceAccountJson'],
    optionalSecrets: [],
    defaultConfig: { ...DEFAULT_COMMON_CONFIG, ...DEFAULT_GOOGLE_CHAT_CONFIG },
  },
  'ms-teams': {
    type: 'ms-teams',
    label: 'MS Teams',
    requiresNodeRuntime: false,
    authMethod: 'credentials',
    requiredSecrets: ['appId', 'appPassword'],
    optionalSecrets: ['tenantId'],
    defaultConfig: { ...DEFAULT_COMMON_CONFIG, ...DEFAULT_MS_TEAMS_CONFIG },
  },
  line: {
    type: 'line',
    label: 'LINE',
    requiresNodeRuntime: false,
    authMethod: 'token',
    requiredSecrets: ['channelToken'],
    optionalSecrets: ['channelSecret'],
    defaultConfig: { ...DEFAULT_COMMON_CONFIG, ...DEFAULT_LINE_CONFIG },
  },
  matrix: {
    type: 'matrix',
    label: 'Matrix',
    requiresNodeRuntime: false,
    authMethod: 'token',
    requiredSecrets: ['accessToken', 'homeserverUrl'],
    optionalSecrets: [],
    defaultConfig: { ...DEFAULT_COMMON_CONFIG, ...DEFAULT_MATRIX_CONFIG },
  },
};

// ============================================
// Secret field names per channel type
// Used for env var substitution in config generation
// ============================================

export const SECRET_FIELDS: Record<OpenClawChannelType, string[]> = {
  whatsapp: [],
  telegram: ['botToken', 'tokenFile'],
  discord: ['token'],
  slack: ['botToken', 'appToken'],
  signal: [],
  imessage: [],
  mattermost: ['token'],
  'google-chat': ['serviceAccountJson'],
  'ms-teams': ['appId', 'appPassword'],
  line: ['channelToken', 'channelSecret'],
  matrix: ['accessToken'],
};
