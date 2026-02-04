/**
 * Resource specification types for OpenClaw deployments.
 *
 * Provides a unified abstraction for resource allocation across
 * different cloud providers (ECS, GCE, Azure VM).
 *
 * Tier specifications are defined in each adapter's getMetadata() method
 * and accessed via the AdapterRegistry.
 */

import { DeploymentTargetType } from "./deployment-target";

/**
 * Resource tier for simplified user selection.
 * Maps to provider-specific configurations internally.
 */
export type ResourceTier = "light" | "standard" | "performance" | "custom";

/**
 * Unified resource specification.
 * Provider implementations translate these to their native formats.
 */
export interface ResourceSpec {
  /** CPU allocation in ECS units (256-4096). For VMs, mapped to machine type. */
  cpu: number;
  /** Memory allocation in MiB (512-30720). For VMs, mapped to machine type. */
  memory: number;
  /** Data disk size in GB for persistent storage (optional). */
  dataDiskSizeGb?: number;
}

/**
 * Result of a resource update operation.
 */
export interface ResourceUpdateResult {
  success: boolean;
  message: string;
  /** Whether the deployment requires a restart for changes to take effect. */
  requiresRestart: boolean;
  /** Estimated downtime in seconds (for operations requiring restart). */
  estimatedDowntime?: number;
}

/**
 * Resource tier specifications by provider.
 */
export interface TierSpec {
  tier: ResourceTier;
  cpu: number;
  memory: number;
  dataDiskSizeGb: number;
  /** Provider-specific machine type (for VM-based providers). */
  machineType?: string;
  /** Provider-specific VM size (for Azure). */
  vmSize?: string;
}

/**
 * Tier display information for the UI.
 */
export interface TierDisplayInfo {
  tier: ResourceTier;
  name: string;
  icon: string;
  description: string;
  features: string[];
  priceRange: string;
}

export const TIER_DISPLAY_INFO: Record<Exclude<ResourceTier, "custom">, TierDisplayInfo> = {
  light: {
    tier: "light",
    name: "Light",
    icon: "lightbulb",
    description: "Basic bots with low traffic",
    features: ["1-2 channels", "Low traffic", "Basic automation"],
    priceRange: "~$5-10/mo",
  },
  standard: {
    tier: "standard",
    name: "Standard",
    icon: "zap",
    description: "Multi-channel bots with moderate traffic",
    features: ["Multi-channel", "WhatsApp included", "Moderate traffic"],
    priceRange: "~$15-25/mo",
  },
  performance: {
    tier: "performance",
    name: "Performance",
    icon: "rocket",
    description: "Full-featured bots with high traffic",
    features: ["All features", "Sandbox mode", "Voice/Browser", "High traffic"],
    priceRange: "~$40-80/mo",
  },
};

// ---------------------------------------------------------------------------
// Registry-based tier lookup
// ---------------------------------------------------------------------------

/**
 * Registry interface for tier spec lookups.
 */
export interface TierSpecRegistry {
  getTierSpec: (type: DeploymentTargetType, tier: Exclude<ResourceTier, "custom">) => TierSpec | undefined;
  getTierSpecs: (type: DeploymentTargetType) => Record<Exclude<ResourceTier, "custom">, TierSpec> | undefined;
}

/**
 * Get tier spec from the adapter registry.
 *
 * @param tier - The resource tier (light, standard, performance)
 * @param targetType - The deployment target type
 * @param registry - The adapter registry instance
 * @returns TierSpec if found, undefined otherwise
 *
 * @example
 * ```typescript
 * import { AdapterRegistry } from "../registry/adapter-registry";
 * const spec = getTierSpecFromRegistry("standard", DeploymentTargetType.ECS_EC2, AdapterRegistry.getInstance());
 * ```
 */
export function getTierSpecFromRegistry(
  tier: Exclude<ResourceTier, "custom">,
  targetType: DeploymentTargetType,
  registry: TierSpecRegistry
): TierSpec | undefined {
  return registry.getTierSpec(targetType, tier);
}

/**
 * Converts a ResourceSpec to the appropriate tier using the registry,
 * or "custom" if it doesn't match any tier.
 *
 * @param spec - The resource specification to match
 * @param targetType - The deployment target type
 * @param registry - The adapter registry instance
 * @returns The matching ResourceTier or "custom"
 */
export function specToTierFromRegistry(
  spec: ResourceSpec,
  targetType: DeploymentTargetType,
  registry: TierSpecRegistry
): ResourceTier {
  const tierSpecs = registry.getTierSpecs(targetType);
  if (!tierSpecs) {
    return "custom";
  }

  for (const [tierName, tierSpec] of Object.entries(tierSpecs)) {
    if (
      spec.cpu === tierSpec.cpu &&
      spec.memory === tierSpec.memory &&
      (spec.dataDiskSizeGb === undefined ||
        spec.dataDiskSizeGb === tierSpec.dataDiskSizeGb)
    ) {
      return tierName as ResourceTier;
    }
  }

  return "custom";
}
