import type { IInstanceLifecycle } from "./instance-lifecycle";
import type { IInstanceStatusProvider } from "./instance-status";
import type { IInstanceCommandExecutor } from "./instance-command";

export type { IInstanceLifecycle } from "./instance-lifecycle";
export type { IInstanceStatusProvider } from "./instance-status";
export type { IInstanceCommandExecutor } from "./instance-command";

/**
 * Combined compute service interface.
 * Use focused interfaces (IInstanceLifecycle, IInstanceStatusProvider, IInstanceCommandExecutor)
 * when possible to follow Interface Segregation Principle.
 */
export interface IComputeService
  extends IInstanceLifecycle,
    IInstanceStatusProvider,
    IInstanceCommandExecutor {}
