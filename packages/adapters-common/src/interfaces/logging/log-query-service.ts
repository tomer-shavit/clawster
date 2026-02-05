import type { LogQueryOptions, LogQueryResult } from "../../types/logging";

/**
 * Interface for querying logs.
 * Part of ISP-compliant logging service split.
 */
export interface ILogQueryService {
  /**
   * Get logs for a resource.
   * @param resourceId - The resource identifier (log group name for AWS, container group name for Azure)
   * @param options - Query options (limit, time range, pagination)
   */
  getLogs(resourceId: string, options?: LogQueryOptions): Promise<LogQueryResult>;

  /**
   * Get log streams for a log group.
   * @param logGroupName - The name of the log group
   */
  getLogStreams(logGroupName: string): Promise<string[]>;
}
