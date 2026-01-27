import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
  DeleteLogGroupCommand,
} from "@aws-sdk/client-cloudwatch-logs";

export interface LogEvent {
  timestamp: Date;
  message: string;
}

export class CloudWatchLogsService {
  private client: CloudWatchLogsClient;

  constructor(region: string = "us-east-1") {
    this.client = new CloudWatchLogsClient({ region });
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
    logGroupName: string,
    options?: {
      startTime?: Date;
      endTime?: Date;
      limit?: number;
      nextToken?: string;
    }
  ): Promise<{ events: LogEvent[]; nextToken?: string }> {
    const streamNames = await this.getLogStreams(logGroupName);
    
    if (streamNames.length === 0) {
      return { events: [] };
    }

    const result = await this.client.send(new GetLogEventsCommand({
      logGroupName,
      logStreamName: streamNames[0],
      startTime: options?.startTime?.getTime(),
      endTime: options?.endTime?.getTime(),
      limit: options?.limit || 100,
      nextToken: options?.nextToken,
    }));

    const events = result.events?.map(event => ({
      timestamp: new Date(event.timestamp || 0),
      message: event.message || "",
    })) || [];

    return {
      events,
      nextToken: result.nextForwardToken,
    };
  }

  // Get deep link to CloudWatch console
  getConsoleLink(logGroupName: string, region?: string): string {
    const r = region || process.env.AWS_REGION || "us-east-1";
    return `https://${r}.console.aws.amazon.com/cloudwatch/home?region=${r}#logsV2:log-groups/log-group/${encodeURIComponent(logGroupName)}`;
  }
}