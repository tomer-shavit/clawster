import type { SecurityRule, SecurityGroupResult } from "../../types/network";

/**
 * Interface for security group/NSG operations.
 * Part of ISP-compliant network service split.
 */
export interface ISecurityGroupService {
  /**
   * Ensure a security group (NSG/firewall) exists with the specified rules.
   * @param name - Security group name
   * @param rules - Security rules to apply
   * @returns Security group result with ID and applied rules
   */
  ensureSecurityGroup(
    name: string,
    rules: SecurityRule[]
  ): Promise<SecurityGroupResult>;
}
