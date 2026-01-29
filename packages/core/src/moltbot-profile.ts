import { z } from "zod";

// =============================================================================
// Multi-Instance Profile Isolation
// =============================================================================

/**
 * Minimum port gap between two Moltbot gateway instances.
 * The docs recommend 20+ to leave room for auxiliary services.
 */
export const MIN_PORT_SPACING = 20;

/**
 * Represents a single Moltbot profile for multi-instance isolation.
 *
 * Each profile gets:
 *   - Dedicated config file   (CLAWDBOT_CONFIG_PATH)
 *   - Isolated state directory (CLAWDBOT_STATE_DIR)
 *   - Separate workspace
 *   - Unique gateway port (spaced 20+ apart)
 *
 * Service naming:
 *   - macOS: bot.molt.<profileName>
 *   - Linux: moltbot-gateway-<profileName>.service
 */
export const MoltbotProfileSchema = z.object({
  /** Human-friendly profile name (also used in service names). */
  name: z
    .string()
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
      "Profile name must be lowercase alphanumeric with optional hyphens, not starting/ending with hyphen",
    )
    .min(1)
    .max(63),

  /** Gateway port for this profile. */
  port: z.number().int().min(1).max(65535),

  /** Path to this profile's moltbot.json config. */
  configPath: z.string().min(1),

  /** Isolated state directory. */
  stateDir: z.string().min(1),

  /** Workspace root for this profile's agents. */
  workspace: z.string().min(1),

  /** Optional description. */
  description: z.string().optional(),

  /** Whether this profile is currently active. */
  enabled: z.boolean().default(true),
});
export type MoltbotProfile = z.infer<typeof MoltbotProfileSchema>;

// =============================================================================
// Multi-Profile Registry (validates port spacing)
// =============================================================================

export const MoltbotProfileRegistrySchema = z
  .object({
    profiles: z.array(MoltbotProfileSchema).min(1),
  })
  .refine(
    (data) => {
      const names = data.profiles.map((p) => p.name);
      return new Set(names).size === names.length;
    },
    { message: "Profile names must be unique" },
  )
  .refine(
    (data) => {
      const ports = data.profiles
        .filter((p) => p.enabled)
        .map((p) => p.port)
        .sort((a, b) => a - b);
      for (let i = 1; i < ports.length; i++) {
        if (ports[i] - ports[i - 1] < MIN_PORT_SPACING) {
          return false;
        }
      }
      return true;
    },
    {
      message: `Enabled profiles must have gateway ports spaced at least ${MIN_PORT_SPACING} apart`,
    },
  );
export type MoltbotProfileRegistry = z.infer<
  typeof MoltbotProfileRegistrySchema
>;

/**
 * Derive the platform-specific service name for a profile.
 */
export function serviceName(
  profileName: string,
  platform: "macos" | "linux",
): string {
  return platform === "macos"
    ? `bot.molt.${profileName}`
    : `moltbot-gateway-${profileName}.service`;
}

/**
 * Build environment variables for launching a profile's gateway.
 */
export function profileEnvVars(profile: MoltbotProfile): Record<string, string> {
  return {
    CLAWDBOT_CONFIG_PATH: profile.configPath,
    CLAWDBOT_STATE_DIR: profile.stateDir,
  };
}
