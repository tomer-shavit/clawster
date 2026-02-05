export type { ILogGroupService } from "./log-group-service";
export type { ILogQueryService } from "./log-query-service";
export type { ILogConsoleService } from "./log-console-service";

import type { LogQueryOptions, LogQueryResult } from "../../types/logging";

/**
 * Combined logging service interface.
 * Use focused interfaces (ILogGroupService, ILogQueryService, ILogConsoleService)
 * when possible to follow Interface Segregation Principle.
 */
export interface ILoggingService {
  /**
   * Get logs for a resource.
   * @param resourceId - The resource identifier (log group name for AWS, container group name for Azure)
   * @param options - Query options (limit, time range, pagination)
   */
  getLogs(resourceId: string, options?: LogQueryOptions): Promise<LogQueryResult>;

  /**
   * Get a console link to view logs in the cloud provider's UI.
   * @param resourceId - The resource identifier
   */
  getConsoleLink(resourceId: string): string;
}
