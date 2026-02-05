export type {
  IStackOperations,
  StackInfo,
  StackOutput,
} from "./stack-operations";
export type { IStackOutputs } from "./stack-outputs";

import type { IStackOperations } from "./stack-operations";
import type { IStackOutputs } from "./stack-outputs";

/**
 * Combined infrastructure service interface.
 * Use focused interfaces (IStackOperations, IStackOutputs)
 * when possible to follow Interface Segregation Principle.
 */
export interface IInfrastructureService
  extends IStackOperations,
    IStackOutputs {}
