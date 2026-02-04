import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
  DeleteLogGroupCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import type {
  ILoggingService,
  LogQueryOptions,
  LogQueryResult,
  LogEvent,
} from "@clawster/adapters-common";

/**
 * AWS CloudWatch Logs service implementing ILoggingService.
 * Uses constructor injection for testability.
 */
export class CloudWatchLogsService implements ILoggingService {
  private readonly region: string;

  constructor(
    private readonly client: CloudWatchLogsClient,
    region: string = "us-east-1"
  ) {
    this.region = region;
  }

  async createLogGroup(logGroupName: string, tags?: Record<string, string>): Promise<void> {
    try {
      await this.client.send(new CreateLogGroupCommand({
        logGroupName,
        tags,
      }));
    } catch (error) {
      // Ignore if already exists
      if ((error as Error).name !== "ResourceAlreadyExistsException") {
        throw error;
      }
    }
  }

  async deleteLogGroup(logGroupName: string): Promise<void> {
    await this.client.send(new DeleteLogGroupCommand({
      logGroupName,
    }));
  }

  async logGroupExists(logGroupName: string): Promise<boolean> {
    try {
      const result = await this.client.send(new DescribeLogGroupsCommand({
        logGroupNamePattern: logGroupName,
      }));
      return result.logGroups?.some(lg => lg.logGroupName === logGroupName) || false;
    } catch {
      return false;
    }
  }

  async getLogStreams(logGroupName: string): Promise<string[]> {
    const result = await this.client.send(new DescribeLogStreamsCommand({
      logGroupName,
      orderBy: "LastEventTime",
      descending: true,
      limit: 10,
    }));

    return result.logStreams?.map(s => s.logStreamName || "") || [];
  }

  async getLogs(
    resourceId: string,
    options?: LogQueryOptions
  ): Promise<LogQueryResult> {
    const streamNames = await this.getLogStreams(resourceId);

    if (streamNames.length === 0) {
      return { events: [] };
    }

    const result = await this.client.send(new GetLogEventsCommand({
      logGroupName: resourceId,
      logStreamName: streamNames[0],
      startTime: options?.startTime?.getTime(),
      endTime: options?.endTime?.getTime(),
      limit: options?.limit ?? 100,
      nextToken: options?.nextToken,
    }));

    const events: LogEvent[] = result.events?.map(event => ({
      timestamp: new Date(event.timestamp ?? 0),
      message: event.message ?? "",
    })) ?? [];

    return {
      events,
      nextToken: result.nextForwardToken,
    };
  }

  getConsoleLink(resourceId: string): string {
    return `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#logsV2:log-groups/log-group/${encodeURIComponent(resourceId)}`;
  }
}

/**
 * Factory function to create a CloudWatchLogsService with default configuration.
 * Provides backward compatibility with the old constructor signature.
 */
export function createCloudWatchLogsService(
  region: string = "us-east-1"
): CloudWatchLogsService {
  return new CloudWatchLogsService(
    new CloudWatchLogsClient({ region }),
    region
  );
}

// Re-export LogEvent for backward compatibility
export type { LogEvent } from "@clawster/adapters-common";
