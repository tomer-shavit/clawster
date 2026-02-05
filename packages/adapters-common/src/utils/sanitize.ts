/**
 * Sanitize a name for use in cloud resources.
 * Handles naming constraints across AWS, Azure, and GCP.
 *
 * @param name - Raw name to sanitize
 * @param maxLength - Maximum length (default: 63 for most cloud resources)
 * @returns Sanitized name safe for cloud resources
 */
export function sanitizeName(name: string, maxLength = 63): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .substring(0, maxLength);

  if (!sanitized) {
    throw new Error(`Invalid name: "${name}" produces empty sanitized value`);
  }

  return sanitized;
}

/**
 * Sanitize a name for Azure Key Vault secrets.
 * Key Vault has specific requirements: alphanumeric and hyphens only, max 127 chars.
 *
 * @param name - Raw name to sanitize
 * @returns Sanitized name safe for Key Vault
 */
export function sanitizeKeyVaultName(name: string): string {
  return sanitizeName(name, 127);
}

/**
 * Sanitize a name for Azure Container Instances.
 * ACI requires max 63 chars.
 *
 * @param name - Raw name to sanitize
 * @returns Sanitized name safe for ACI
 */
export function sanitizeAciName(name: string): string {
  return sanitizeName(name, 63);
}

/**
 * Sanitize a name for AWS resources.
 * Most AWS resources allow 63-256 chars depending on service.
 *
 * @param name - Raw name to sanitize
 * @param maxLength - Maximum length (default: 255)
 * @returns Sanitized name safe for AWS
 */
export function sanitizeAwsName(name: string, maxLength = 255): string {
  return sanitizeName(name, maxLength);
}

/**
 * Sanitize a name for GCP Secret Manager secrets.
 * Secret names can contain uppercase and lowercase letters, numbers, hyphens, and underscores.
 * Must start with a letter. Max 255 chars.
 *
 * @param name - Raw name to sanitize
 * @returns Sanitized name safe for GCP Secret Manager
 */
export function sanitizeGcpSecretName(name: string): string {
  const sanitized = name
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 255);

  if (!sanitized) {
    throw new Error(`Invalid name: "${name}" produces empty sanitized value`);
  }

  // GCP secret names must start with a letter
  if (!/^[a-zA-Z]/.test(sanitized)) {
    return `s${sanitized}`;
  }

  return sanitized;
}

/**
 * Sanitize a value for use as a GCP label.
 * Labels can contain lowercase letters, numbers, hyphens, and underscores.
 * Max 63 chars.
 *
 * @param value - Raw value to sanitize
 * @returns Sanitized value safe for GCP labels
 */
export function sanitizeGcpLabel(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 63);

  if (!sanitized) {
    throw new Error(`Invalid label: "${value}" produces empty sanitized value`);
  }

  return sanitized;
}
