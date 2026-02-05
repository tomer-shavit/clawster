import type { IVpcService } from "./vpc-service";
import type { ISubnetService } from "./subnet-service";
import type { ISecurityGroupService } from "./security-group-service";

export type { IVpcService } from "./vpc-service";
export type { ISubnetService } from "./subnet-service";
export type { ISecurityGroupService } from "./security-group-service";

/**
 * Combined network service interface.
 * Use focused interfaces (IVpcService, ISubnetService, ISecurityGroupService)
 * when possible to follow Interface Segregation Principle.
 */
export interface INetworkService
  extends IVpcService,
    ISubnetService,
    ISecurityGroupService {}
