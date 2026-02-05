/**
 * GCP Log Query Service
 *
 * Handles log query operations.
 * Part of the ISP-compliant logging service split.
 */

import { Logging, Entry } from "@google-cloud/logging";
import type { ILogQueryService } from "@clawster/adapters-common";
import type { LogQueryOptions, LogQueryResult, LogEvent } from "@clawster/adapters-common/dist/types/logging";

export interface GcpLogQueryOptions {
  /** Start time for log query */
  startTime?: Date;
  /** End time for log query */
  endTime?: Date;
  /** Maximum number of entries to return */
  limit?: number;
  /** Filter expression (in addition to resource filter) */
  filter?: string;
  /** Page token for pagination */
  pageToken?: string;
}

/**
 * GCP Log Query Service for querying logs.
 * Implements ILogQueryService interface.
 */
export class LogQueryService implements ILogQueryService {
  private readonly logging: Logging;
  private readonly projectId: string;

  constructor(logging: Logging, projectId: string) {
    this.logging = logging;
    this.projectId = projectId;
  }

  /**
   * Get logs for a resource.
   * Implements ILogQueryService.getLogs.
   */
  async getLogs(resourceId: string, options?: LogQueryOptions): Promise<LogQueryResult> {
    const limit = Math.max(1, Math.min(options?.limit || 100, 10000));

    // Build filter for the resource
    let filter = `resource.labels.instance_id="${resourceId}"`;

    // Add time range
    if (options?.startTime) {
      filter += ` AND timestamp >= "${options.startTime.toISOString()}"`;
    }
    if (options?.endTime) {
      filter += ` AND timestamp <= "${options.endTime.toISOString()}"`;
    }

    const [entries, , response] = await this.logging.getEntries({
      filter,
      pageSize: limit,
      pageToken: options?.nextToken,
      orderBy: "timestamp desc",
    });

    const events: LogEvent[] = entries.map((entry) => this.entryToLogEvent(entry));

    return {
      events,
      nextToken: response?.nextPageToken ?? undefined,
    };
  }

  /**
   * Get log streams for a log group.
   * Implements ILogQueryService.getLogStreams.
   * Note: GCP doesn't have the same concept of log streams as AWS.
   */
  async getLogStreams(logGroupName: string): Promise<string[]> {
    // GCP doesn't have log streams in the same way AWS does
    // Return a single stream name based on the log group name
    return [logGroupName];
  }

  /**
   * Get logs for a specific Compute Engine instance.
   *
   * @param instanceName - VM instance name
   * @param zone - Zone where the instance is located
   * @param options - Query options
   * @returns Log events and optional page token
   */
  async getInstanceLogs(
    instanceName: string,
    zone: string,
    options?: GcpLogQueryOptions
  ): Promise<{ events: LogEvent[]; nextPageToken?: string }> {
    const limit = Math.max(1, Math.min(options?.limit || 100, 10000));

    // Build filter for Compute Engine instance logs
    let filter = `resource.type="gce_instance" AND resource.labels.instance_id="${instanceName}"`;

    // Add time range
    if (options?.startTime) {
      filter += ` AND timestamp >= "${options.startTime.toISOString()}"`;
    }
    if (options?.endTime) {
      filter += ` AND timestamp <= "${options.endTime.toISOString()}"`;
    }

    // Add custom filter
    if (options?.filter) {
      filter += ` AND (${options.filter})`;
    }

    const [entries, , response] = await this.logging.getEntries({
      filter,
      pageSize: limit,
      pageToken: options?.pageToken,
      orderBy: "timestamp desc",
    });

    const events: LogEvent[] = entries.map((entry) => this.entryToLogEvent(entry));

    return {
      events,
      nextPageToken: response?.nextPageToken ?? undefined,
    };
  }

  /**
   * Query logs with a custom filter expression.
   *
   * @param filter - Cloud Logging filter expression
   * @param options - Query options (startTime, endTime, limit override the filter)
   * @returns Log events and optional page token
   */
  async queryLogs(
    filter: string,
    options?: Omit<GcpLogQueryOptions, "filter">
  ): Promise<{ events: LogEvent[]; nextPageToken?: string }> {
    const limit = Math.max(1, Math.min(options?.limit || 100, 10000));

    let fullFilter = filter;

    // Add time range
    if (options?.startTime) {
      fullFilter += ` AND timestamp >= "${options.startTime.toISOString()}"`;
    }
    if (options?.endTime) {
      fullFilter += ` AND timestamp <= "${options.endTime.toISOString()}"`;
    }

    const [entries, , response] = await this.logging.getEntries({
      filter: fullFilter,
      pageSize: limit,
      pageToken: options?.pageToken,
      orderBy: "timestamp desc",
    });

    const events: LogEvent[] = entries.map((entry) => this.entryToLogEvent(entry));

    return {
      events,
      nextPageToken: response?.nextPageToken ?? undefined,
    };
  }

  /**
   * Get logs for a Clawster OpenClaw instance by workspace and instance name.
   *
   * @param workspace - Workspace name
   * @param instanceName - Instance name
   * @param options - Query options
   * @returns Log events and optional page token
   */
  async getClawsterInstanceLogs(
    workspace: string,
    instanceName: string,
    options?: GcpLogQueryOptions
  ): Promise<{ events: LogEvent[]; nextPageToken?: string }> {
    const filter = `labels.workspace="${workspace}" AND labels.instance="${instanceName}"`;
    return this.queryLogs(filter, options);
  }

  /**
   * Convert a Cloud Logging entry to LogEvent format.
   */
  private entryToLogEvent(entry: Entry): LogEvent {
    const metadata = entry.metadata;
    const data = entry.data;

    let message: string;
    if (typeof data === "string") {
      message = data;
    } else if (data && typeof data === "object") {
      message = (data as { message?: string }).message || JSON.stringify(data);
    } else {
      message = String(data ?? "");
    }

    let timestamp: Date;
    if (metadata?.timestamp) {
      timestamp = new Date(metadata.timestamp as string);
    } else if (metadata?.receiveTimestamp) {
      timestamp = new Date(metadata.receiveTimestamp as string);
    } else {
      timestamp = new Date();
    }

    return {
      timestamp,
      message,
    };
  }
}
