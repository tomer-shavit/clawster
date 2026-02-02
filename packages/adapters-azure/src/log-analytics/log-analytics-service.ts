import { LogsQueryClient, LogsQueryResultStatus, LogsTable } from "@azure/monitor-query";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";

export interface LogEvent {
  timestamp: Date;
  message: string;
}

export class LogAnalyticsService {
  private client: LogsQueryClient;
  private workspaceId: string;

  constructor(workspaceId: string, credential?: TokenCredential) {
    this.client = new LogsQueryClient(credential || new DefaultAzureCredential());
    this.workspaceId = workspaceId;
  }

  async queryLogs(
    containerGroupName: string,
    options?: {
      limit?: number;
    }
  ): Promise<{ events: LogEvent[] }> {
    const limit = Math.max(1, Math.min(Math.floor(options?.limit || 100), 10000));
    const duration = "P1D";

    const safeName = this.escapeKql(containerGroupName);
    const query = `ContainerInstanceLog_CL
      | where ContainerGroup_s == "${safeName}"
      | order by TimeGenerated desc
      | take ${limit}
      | project TimeGenerated, Message`;

    const result = await this.client.queryWorkspace(
      this.workspaceId,
      query,
      { duration },
      {
        serverTimeoutInSeconds: 30,
      }
    );

    const events: LogEvent[] = [];

    let table: LogsTable | undefined;
    if (result.status === LogsQueryResultStatus.Success) {
      table = result.tables[0];
    } else if (result.status === LogsQueryResultStatus.PartialFailure) {
      table = result.partialTables[0];
    }

    if (table) {
      for (const row of table.rows) {
        events.push({
          timestamp: new Date(row[0] as string),
          message: (row[1] as string) || "",
        });
      }
    }

    return { events };
  }

  getConsoleLink(
    containerGroupName: string,
    subscriptionId: string,
    resourceGroup: string
  ): string {
    const resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.ContainerInstance/containerGroups/${containerGroupName}`;
    return `https://portal.azure.com/#@/resource${resourceId}/logs`;
  }

  private escapeKql(value: string): string {
    return value.replace(/[\x00-\x1f\\"]/g, "\\$&");
  }
}
