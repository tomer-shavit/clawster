/**
 * Service Tokens
 *
 * Symbols used as keys for dependency injection.
 */

export const SERVICE_TOKENS = {
  Output: Symbol("Output"),
  FileSystem: Symbol("FileSystem"),
  Shell: Symbol("Shell"),
  Prompts: Symbol("Prompts"),
} as const;

export type ServiceTokens = typeof SERVICE_TOKENS;
