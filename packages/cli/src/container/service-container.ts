/**
 * Service Container
 *
 * A lightweight dependency injection container.
 */

export interface IServiceContainer {
  /**
   * Register a service implementation.
   */
  register<T>(token: symbol, implementation: T): void;

  /**
   * Resolve a service by token.
   */
  resolve<T>(token: symbol): T;

  /**
   * Check if a service is registered.
   */
  has(token: symbol): boolean;

  /**
   * Create a child scope that inherits parent registrations.
   */
  createScope(): IServiceContainer;
}

export class ServiceContainer implements IServiceContainer {
  private services: Map<symbol, unknown> = new Map();
  private parent: ServiceContainer | null = null;

  constructor(parent?: ServiceContainer) {
    this.parent = parent ?? null;
  }

  register<T>(token: symbol, implementation: T): void {
    this.services.set(token, implementation);
  }

  resolve<T>(token: symbol): T {
    // Check local registrations first
    if (this.services.has(token)) {
      return this.services.get(token) as T;
    }

    // Check parent scope
    if (this.parent) {
      return this.parent.resolve<T>(token);
    }

    throw new Error(`Service not registered: ${token.toString()}`);
  }

  has(token: symbol): boolean {
    if (this.services.has(token)) {
      return true;
    }
    if (this.parent) {
      return this.parent.has(token);
    }
    return false;
  }

  createScope(): IServiceContainer {
    return new ServiceContainer(this);
  }
}
