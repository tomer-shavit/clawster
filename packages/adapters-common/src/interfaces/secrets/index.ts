import type { ISecretReader } from "./secret-reader";
import type { ISecretWriter } from "./secret-writer";
import type { ISecretProvisioner } from "./secret-provisioner";

export type { ISecretReader } from "./secret-reader";
export type { ISecretWriter } from "./secret-writer";
export type { ISecretProvisioner } from "./secret-provisioner";

/**
 * Combined secrets service interface.
 * Use focused interfaces (ISecretReader, ISecretWriter, ISecretProvisioner)
 * when possible to follow Interface Segregation Principle.
 */
export interface ISecretsService
  extends ISecretReader,
    ISecretWriter,
    ISecretProvisioner {}
