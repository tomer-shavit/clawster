/**
 * CloudWatch Logs Service Facade
 *
 * Unified facade implementing ILoggingService by composing focused services.
 * Each focused service handles a single responsibility:
 * - LogGroupService: Log group lifecycle
 * - LogQueryService: Log querying
 * - LogConsoleService: Console link generation
 */

import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import type {
  ILoggingService,
  ILogGroupService,
  ILogQueryService,
  ILogConsoleService,
  LogQueryOptions,
  LogQueryResult,
} from "@clawster/adapters-common";

import { LogGroupService } from "./services/log-group-service";
import { LogQueryService } from "./services/log-query-service";
import { LogConsoleService } from "./services/log-console-service";

/**
 * AWS CloudWatch Logs service implementing ILoggingService.
 * Composes focused services following Single Responsibility Principle.
 */
export class CloudWatchLogsService
  implements ILoggingService, ILogGroupService, ILogQueryService, ILogConsoleService
{
  private readonly logGroupService: LogGroupService;
  private readonly logQueryService: LogQueryService;
  private readonly logConsoleService: LogConsoleService;

  constructor(
    private readonly client: CloudWatchLogsClient,
    private readonly region: string = "us-east-1"
  ) {
    this.logGroupService = new LogGroupService(client);
    this.logQueryService = new LogQueryService(client);
    this.logConsoleService = new LogConsoleService(region);
  }

  // --- ILogGroupService ---

  async createLogGroup(
    logGroupName: string,
    tags?: Record<string, string>
  ): Promise<void> {
    return this.logGroupService.createLogGroup(logGroupName, tags);
  }

  async deleteLogGroup(logGroupName: string): Promise<void> {
    return this.logGroupService.deleteLogGroup(logGroupName);
  }

  async logGroupExists(logGroupName: string): Promise<boolean> {
    return this.logGroupService.logGroupExists(logGroupName);
  }

  // --- ILogQueryService ---

  async getLogStreams(logGroupName: string): Promise<string[]> {
    return this.logQueryService.getLogStreams(logGroupName);
  }

  async getLogs(
    resourceId: string,
    options?: LogQueryOptions
  ): Promise<LogQueryResult> {
    return this.logQueryService.getLogs(resourceId, options);
  }

  // --- ILogConsoleService ---

  getConsoleLink(resourceId: string): string {
    return this.logConsoleService.getConsoleLink(resourceId);
  }
}

/**
 * Factory function to create a CloudWatchLogsService.
 */
export function createCloudWatchLogsService(
  region: string = "us-east-1"
): CloudWatchLogsService {
  return new CloudWatchLogsService(new CloudWatchLogsClient({ region }), region);
}

// Re-export for convenience
export type { LogEvent } from "@clawster/adapters-common";
