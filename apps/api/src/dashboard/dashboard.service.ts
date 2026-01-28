import { Injectable } from "@nestjs/common";
import { prisma, BotHealth, InstanceStatus } from "@molthub/database";

export interface DashboardMetrics {
  totalBots: number;
  totalFleets: number;
  healthyBots: number;
  degradedBots: number;
  unhealthyBots: number;
  messageVolume: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  failureRate: number;
  costPerHour: number;
  activeChangeSets: number;
  failedDeployments: number;
}

export interface OverallHealth {
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  fleetHealth: Array<{
    fleetId: string;
    fleetName: string;
    totalInstances: number;
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
  }>;
  recentAlerts: Array<{
    id: string;
    severity: "CRITICAL" | "WARNING" | "INFO";
    message: string;
    timestamp: Date;
    resourceId?: string;
    resourceType?: string;
  }>;
}

export interface RecentActivity {
  events: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: Date;
    actor: string;
    resourceId?: string;
    resourceType?: string;
  }>;
  traces: Array<{
    id: string;
    traceId: string;
    botName: string;
    name: string;
    type: string;
    status: string;
    durationMs?: number;
    timestamp: Date;
  }>;
}

@Injectable()
export class DashboardService {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    // Get bot counts by health
    const botsByHealth = await prisma.botInstance.groupBy({
      by: ["health"],
      _count: { id: true },
    });

    const healthCounts = botsByHealth.reduce((acc, item) => {
      acc[item.health] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Get total fleets
    const totalFleets = await prisma.fleet.count();

    // Get active change sets (in progress)
    const activeChangeSets = await prisma.changeSet.count({
      where: { status: "IN_PROGRESS" },
    });

    // Get failed deployments in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const failedDeployments = await prisma.deploymentEvent.count({
      where: {
        eventType: "RECONCILE_ERROR",
        createdAt: { gte: oneHourAgo },
      },
    });

    // Get recent traces for metrics calculation
    const recentTraces = await prisma.trace.findMany({
      where: {
        startedAt: { gte: oneHourAgo },
      },
      select: {
        durationMs: true,
        status: true,
      },
    });

    // Calculate latency percentiles
    const durations = recentTraces
      .map((t) => t.durationMs)
      .filter((d): d is number => d !== null && d !== undefined)
      .sort((a, b) => a - b);

    const p50 = this.percentile(durations, 0.5);
    const p95 = this.percentile(durations, 0.95);
    const p99 = this.percentile(durations, 0.99);

    // Calculate failure rate
    const totalTraces = recentTraces.length;
    const failedTraces = recentTraces.filter((t) => t.status === "ERROR").length;
    const failureRate = totalTraces > 0 ? (failedTraces / totalTraces) * 100 : 0;

    // Estimate message volume (traces in last hour)
    const messageVolume = totalTraces;

    // Estimate cost (mock calculation based on instance count)
    const totalBots = Object.values(healthCounts).reduce((a, b) => a + b, 0);
    const costPerHour = totalBots * 0.05; // $0.05 per bot per hour

    return {
      totalBots,
      totalFleets,
      healthyBots: healthCounts[BotHealth.HEALTHY] || 0,
      degradedBots: healthCounts[BotHealth.DEGRADED] || 0,
      unhealthyBots: healthCounts[BotHealth.UNHEALTHY] || 0,
      messageVolume,
      latencyP50: p50 || 0,
      latencyP95: p95 || 0,
      latencyP99: p99 || 0,
      failureRate: Math.round(failureRate * 100) / 100,
      costPerHour: Math.round(costPerHour * 100) / 100,
      activeChangeSets,
      failedDeployments,
    };
  }

  async getOverallHealth(): Promise<OverallHealth> {
    const fleets = await prisma.fleet.findMany({
      include: {
        instances: {
          select: {
            health: true,
          },
        },
      },
    });

    const fleetHealth = fleets.map((fleet) => {
      const healthCounts = fleet.instances.reduce((acc, instance) => {
        acc[instance.health] = (acc[instance.health] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        fleetId: fleet.id,
        fleetName: fleet.name,
        totalInstances: fleet.instances.length,
        healthyCount: healthCounts[BotHealth.HEALTHY] || 0,
        degradedCount: healthCounts[BotHealth.DEGRADED] || 0,
        unhealthyCount: healthCounts[BotHealth.UNHEALTHY] || 0,
      };
    });

    // Determine overall status
    const totalUnhealthy = fleetHealth.reduce((sum, f) => sum + f.unhealthyCount, 0);
    const totalDegraded = fleetHealth.reduce((sum, f) => sum + f.degradedCount, 0);
    const totalInstances = fleetHealth.reduce((sum, f) => sum + f.totalInstances, 0);

    let status: "HEALTHY" | "DEGRADED" | "UNHEALTHY" = "HEALTHY";
    if (totalUnhealthy > 0) {
      status = "UNHEALTHY";
    } else if (totalDegraded > 0 || (totalInstances > 0 && totalUnhealthy / totalInstances > 0.1)) {
      status = "DEGRADED";
    }

    // Get recent alerts from deployment events and errors
    const recentErrors = await prisma.deploymentEvent.findMany({
      where: {
        eventType: "RECONCILE_ERROR",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const recentAlerts = recentErrors.map((error) => ({
      id: error.id,
      severity: "WARNING" as const,
      message: error.message,
      timestamp: error.createdAt,
      resourceId: error.instanceId,
      resourceType: "INSTANCE",
    }));

    return {
      status,
      fleetHealth,
      recentAlerts,
    };
  }

  async getRecentActivity(): Promise<RecentActivity> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Get recent audit events
    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        timestamp: { gte: oneHourAgo },
      },
      orderBy: { timestamp: "desc" },
      take: 20,
    });

    // Get recent traces with bot names
    const traces = await prisma.trace.findMany({
      where: {
        startedAt: { gte: oneHourAgo },
      },
      include: {
        botInstance: {
          select: { name: true },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 20,
    });

    const events = auditEvents.map((event) => ({
      id: event.id,
      type: event.action,
      message: `${event.action} on ${event.resourceType}`,
      timestamp: event.timestamp,
      actor: event.actor,
      resourceId: event.resourceId,
      resourceType: event.resourceType,
    }));

    const traceData = traces.map((trace) => ({
      id: trace.id,
      traceId: trace.traceId,
      botName: trace.botInstance?.name || "Unknown",
      name: trace.name,
      type: trace.type,
      status: trace.status,
      durationMs: trace.durationMs || undefined,
      timestamp: trace.startedAt,
    }));

    return {
      events,
      traces: traceData,
    };
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, index)];
  }
}
