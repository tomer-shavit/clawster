/**
 * Adapter Registry
 *
 * Central registry for deployment target adapters. Replaces switch statements
 * in the factory and reconciler with a self-registration pattern.
 *
 * Adapters register themselves on import, enabling true pluggability:
 * - New adapters can be added without modifying existing code
 * - The reconciler queries the registry for step definitions
 * - The factory creates targets via the registry
 */

import type { DeploymentTarget, DeploymentTargetType } from "../interface/deployment-target";
import type {
  AdapterMetadata,
  ProvisioningStepDefinition,
} from "../interface/adapter-metadata";
import type { TierSpec, ResourceTier } from "../interface/resource-spec";

/**
 * Factory function type for creating deployment targets.
 */
export type AdapterFactory<TConfig = unknown> = (config: TConfig) => DeploymentTarget;

/**
 * Registration entry for an adapter.
 */
interface AdapterRegistration {
  factory: AdapterFactory;
  metadata: AdapterMetadata;
}

/**
 * Singleton registry for deployment target adapters.
 *
 * Usage:
 * ```typescript
 * // Register an adapter (typically in the adapter's module)
 * AdapterRegistry.getInstance().register(
 *   DeploymentTargetType.DOCKER,
 *   (config) => new DockerContainerTarget(config.docker),
 *   DOCKER_METADATA
 * );
 *
 * // Create a target via the registry
 * const target = AdapterRegistry.getInstance().create(config);
 *
 * // Query adapter metadata
 * const steps = AdapterRegistry.getInstance().getProvisioningSteps(type);
 * ```
 */
export class AdapterRegistry {
  private static instance: AdapterRegistry;
  private readonly adapters = new Map<DeploymentTargetType, AdapterRegistration>();

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton registry instance.
   */
  static getInstance(): AdapterRegistry {
    if (!AdapterRegistry.instance) {
      AdapterRegistry.instance = new AdapterRegistry();
    }
    return AdapterRegistry.instance;
  }

  /**
   * Reset the registry (primarily for testing).
   */
  static resetInstance(): void {
    AdapterRegistry.instance = new AdapterRegistry();
  }

  /**
   * Register a deployment target adapter.
   *
   * @param type - The deployment target type
   * @param factory - Factory function to create target instances
   * @param metadata - Adapter metadata describing capabilities and steps
   */
  register(
    type: DeploymentTargetType,
    factory: AdapterFactory,
    metadata: AdapterMetadata
  ): void {
    if (this.adapters.has(type)) {
      console.warn(`Adapter for ${type} is being re-registered`);
    }
    this.adapters.set(type, { factory, metadata });
  }

  /**
   * Check if an adapter is registered for the given type.
   */
  isRegistered(type: DeploymentTargetType): boolean {
    return this.adapters.has(type);
  }

  /**
   * Create a deployment target instance.
   *
   * @param config - Configuration object with type and provider-specific config
   * @returns Deployment target instance
   * @throws Error if no adapter is registered for the type
   */
  create(config: { type: string } & Record<string, unknown>): DeploymentTarget {
    const entry = this.adapters.get(config.type as DeploymentTargetType);
    if (!entry) {
      throw new Error(
        `No adapter registered for deployment target type: ${config.type}. ` +
        `Available types: ${this.getRegisteredTypes().join(", ")}`
      );
    }
    return entry.factory(config);
  }

  /**
   * Get metadata for a specific adapter type.
   */
  getMetadata(type: DeploymentTargetType): AdapterMetadata | undefined {
    return this.adapters.get(type)?.metadata;
  }

  /**
   * Get metadata for all registered adapters.
   */
  getAllMetadata(): AdapterMetadata[] {
    return Array.from(this.adapters.values()).map((entry) => entry.metadata);
  }

  /**
   * Get all registered deployment target types.
   */
  getRegisteredTypes(): DeploymentTargetType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get provisioning steps for a specific adapter type.
   */
  getProvisioningSteps(type: DeploymentTargetType): ProvisioningStepDefinition[] {
    return this.getMetadata(type)?.provisioningSteps ?? [];
  }

  /**
   * Get resource update steps for a specific adapter type.
   */
  getResourceUpdateSteps(type: DeploymentTargetType): ProvisioningStepDefinition[] {
    return this.getMetadata(type)?.resourceUpdateSteps ?? [];
  }

  /**
   * Get the step ID for a specific operation.
   */
  getOperationStepId(
    type: DeploymentTargetType,
    operation: "install" | "start"
  ): string | undefined {
    return this.getMetadata(type)?.operationSteps[operation];
  }

  /**
   * Get tier specifications for a specific adapter type.
   */
  getTierSpecs(
    type: DeploymentTargetType
  ): Record<Exclude<ResourceTier, "custom">, TierSpec> | undefined {
    return this.getMetadata(type)?.tierSpecs;
  }

  /**
   * Get tier spec for a specific tier and adapter type.
   */
  getTierSpec(
    type: DeploymentTargetType,
    tier: Exclude<ResourceTier, "custom">
  ): TierSpec | undefined {
    return this.getTierSpecs(type)?.[tier];
  }

  /**
   * Get adapters filtered by status.
   */
  getAdaptersByStatus(status: "ready" | "beta" | "coming_soon"): AdapterMetadata[] {
    return this.getAllMetadata().filter((m) => m.status === status);
  }

  /**
   * Get adapters that support a specific capability.
   */
  getAdaptersWithCapability(
    capability: keyof AdapterMetadata["capabilities"]
  ): AdapterMetadata[] {
    return this.getAllMetadata().filter((m) => m.capabilities[capability]);
  }
}
