/**
 * GCP Cloud Logging Service (Facade)
 *
 * Provides a unified interface for GCP Cloud Logging operations.
 * Delegates to specialized sub-services following SOLID principles.
 */

import { Logging, Log, Entry } from "@google-cloud/logging";
import type { ILoggingService } from "@clawster/adapters-common";
import type { LogQueryOptions, LogQueryResult, LogEvent as CommonLogEvent } from "@clawster/adapters-common/dist/types/logging";

import { LogQueryService, GcpLogQueryOptions } from "./services/log-query-service";
import { LogConsoleService } from "./services/log-console-service";

export interface LogEvent {
  timestamp: Date;
  message: string;
  severity?: string;
  labels?: Record<string, string>;
}

export interface CloudLoggingServiceConfig {
  projectId: string;
  keyFilename?: string;
  credentials?: {
    client_email: string;
    private_key: string;
  };
}

export { GcpLogQueryOptions as LogQueryOptions };

/**
 * GCP Cloud Logging Service (Facade) for log operations.
 * Implements ILoggingService interface.
 */
export class CloudLoggingService implements ILoggingService {
  private readonly logging: Logging;
  private readonly projectId: string;
  private readonly queryService: LogQueryService;
  private readonly consoleService: LogConsoleService;

  constructor(config: CloudLoggingServiceConfig) {
    const clientOptions: { projectId: string; keyFilename?: string; credentials?: { client_email: string; private_key: string } } = {
      projectId: config.projectId,
    };

    if (config.keyFilename) {
      clientOptions.keyFilename = config.keyFilename;
    } else if (config.credentials) {
      clientOptions.credentials = config.credentials;
    }

    this.logging = new Logging(clientOptions);
    this.projectId = config.projectId;

    this.queryService = new LogQueryService(this.logging, config.projectId);
    this.consoleService = new LogConsoleService(config.projectId);
  }

  /**
   * Create with pre-constructed sub-services (for testing/DI).
   */
  static fromServices(
    logging: Logging,
    projectId: string,
    queryService: LogQueryService,
    consoleService: LogConsoleService
  ): CloudLoggingService {
    const instance = Object.create(CloudLoggingService.prototype);
    instance.logging = logging;
    instance.projectId = projectId;
    instance.queryService = queryService;
    instance.consoleService = consoleService;
    return instance;
  }

  // ------------------------------------------------------------------
  // ILoggingService implementation
  // ------------------------------------------------------------------

  /**
   * Get logs for a resource.
   * Implements ILoggingService.getLogs.
   */
  async getLogs(resourceId: string, options?: LogQueryOptions): Promise<LogQueryResult> {
    return this.queryService.getLogs(resourceId, options);
  }

  /**
   * Get a console link to view logs in the cloud provider's UI.
   * Implements ILoggingService.getConsoleLink.
   */
  getConsoleLink(resourceId: string): string {
    return this.consoleService.getConsoleLink(resourceId);
  }

  // ------------------------------------------------------------------
  // GCP-specific methods (for backward compatibility)
  // ------------------------------------------------------------------

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
    const result = await this.queryService.getInstanceLogs(instanceName, zone, options);
    return {
      events: result.events.map((e) => this.toGcpLogEvent(e)),
      nextPageToken: result.nextPageToken,
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
    const result = await this.queryService.queryLogs(filter, options);
    return {
      events: result.events.map((e) => this.toGcpLogEvent(e)),
      nextPageToken: result.nextPageToken,
    };
  }

  /**
   * Get logs for a Clawster OpenClaw instance.
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
    const result = await this.queryService.getClawsterInstanceLogs(workspace, instanceName, options);
    return {
      events: result.events.map((e) => this.toGcpLogEvent(e)),
      nextPageToken: result.nextPageToken,
    };
  }

  /**
   * Write a log entry.
   *
   * @param logName - Log name
   * @param message - Log message
   * @param severity - Log severity
   * @param labels - Optional labels
   */
  async writeLog(
    logName: string,
    message: string,
    severity: string = "INFO",
    labels?: Record<string, string>
  ): Promise<void> {
    const log = this.logging.log(logName);

    const entry = log.entry(
      {
        resource: {
          type: "global",
        },
        severity,
        labels,
      },
      message
    );

    await log.write(entry);
  }

  /**
   * Get a link to the Cloud Logging console for a specific instance.
   *
   * @param instanceName - VM instance name
   * @param zone - Zone where the instance is located
   * @returns URL to Cloud Console logs viewer
   */
  getInstanceConsoleLink(instanceName: string, zone: string): string {
    return this.consoleService.getInstanceConsoleLink(instanceName, zone);
  }

  /**
   * Get a link to Cloud Console logs with a custom filter.
   *
   * @param filter - Cloud Logging filter expression
   * @returns URL to Cloud Console logs viewer
   */
  getConsoleQueryLink(filter: string): string {
    return this.consoleService.getConsoleQueryLink(filter);
  }

  /**
   * Stream logs in real-time using tail.
   *
   * @param filter - Cloud Logging filter expression
   * @returns Async iterator of log events
   */
  async *tailLogs(filter: string): AsyncGenerator<LogEvent> {
    let lastTimestamp = new Date();

    while (true) {
      const fullFilter = `${filter} AND timestamp > "${lastTimestamp.toISOString()}"`;

      const [entries] = await this.logging.getEntries({
        filter: fullFilter,
        pageSize: 100,
        orderBy: "timestamp asc",
      });

      for (const entry of entries) {
        const event = this.entryToLogEvent(entry);
        lastTimestamp = event.timestamp;
        yield event;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  /**
   * Delete logs matching a filter.
   *
   * @param logName - Log name to delete entries from
   */
  async deleteLog(logName: string): Promise<void> {
    const log = this.logging.log(logName);
    await log.delete();
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
      severity: metadata?.severity as string | undefined,
      labels: metadata?.labels as Record<string, string> | undefined,
    };
  }

  /**
   * Convert common LogEvent to GCP-specific LogEvent format.
   */
  private toGcpLogEvent(event: CommonLogEvent): LogEvent {
    return {
      timestamp: event.timestamp,
      message: event.message,
    };
  }
}
