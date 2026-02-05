import type { ISecretRotator } from "./secret-rotator";
import type { IRotationChecker } from "./rotation-checker";

export type { ISecretRotator } from "./secret-rotator";
export type { IRotationChecker } from "./rotation-checker";

/**
 * Combined secret rotation service interface.
 * Use focused interfaces (ISecretRotator, IRotationChecker)
 * when possible to follow Interface Segregation Principle.
 */
export interface ISecretRotationService
  extends ISecretRotator,
    IRotationChecker {}
