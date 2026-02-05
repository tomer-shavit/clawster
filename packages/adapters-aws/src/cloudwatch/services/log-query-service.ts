/**
 * Log Query Service
 *
 * Handles log querying operations (getLogs, getLogStreams).
 * Part of SRP-compliant CloudWatch service split.
 */

import {
  CloudWatchLogsClient,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import type {
  ILogQueryService,
  LogQueryOptions,
  LogQueryResult,
  LogEvent,
} from "@clawster/adapters-common";

export class LogQueryService implements ILogQueryService {
  constructor(private readonly client: CloudWatchLogsClient) {}

  /**
   * Get log streams for a log group.
   */
  async getLogStreams(logGroupName: string): Promise<string[]> {
    const result = await this.client.send(
      new DescribeLogStreamsCommand({
        logGroupName,
        orderBy: "LastEventTime",
        descending: true,
        limit: 10,
      })
    );

    return result.logStreams?.map((s) => s.logStreamName ?? "") ?? [];
  }

  /**
   * Get logs from a log group.
   */
  async getLogs(
    resourceId: string,
    options?: LogQueryOptions
  ): Promise<LogQueryResult> {
    const streamNames = await this.getLogStreams(resourceId);

    if (streamNames.length === 0) {
      return { events: [] };
    }

    const result = await this.client.send(
      new GetLogEventsCommand({
        logGroupName: resourceId,
        logStreamName: streamNames[0],
        startTime: options?.startTime?.getTime(),
        endTime: options?.endTime?.getTime(),
        limit: options?.limit ?? 100,
        nextToken: options?.nextToken,
      })
    );

    const events: LogEvent[] =
      result.events?.map((event) => ({
        timestamp: new Date(event.timestamp ?? 0),
        message: event.message ?? "",
      })) ?? [];

    return {
      events,
      nextToken: result.nextForwardToken,
    };
  }
}
