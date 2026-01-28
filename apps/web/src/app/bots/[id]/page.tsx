export const dynamic = 'force-dynamic';

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, HealthIndicator } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TimeDisplay, DurationDisplay } from "@/components/ui/time-display";
import { api, type BotInstance, type Trace, type TraceStats, type ChangeSet, type DeploymentEvent } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  Bot, 
  Activity, 
  RotateCcw, 
  Pause, 
  Play, 
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Zap,
  FileText,
  GitBranch,
  Terminal,
  ChevronRight,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";

async function getBotData(id: string) {
  try {
    const to = new Date();
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
    
    const [bot, traces, metrics, changeSets, events] = await Promise.all([
      api.getBotInstance(id),
      api.listTraces({ botInstanceId: id, from, to, limit: 100 }),
      api.getBotInstanceMetrics(id, from, to),
      api.listChangeSets({ botInstanceId: id }),
      api.listDeploymentEvents(id),
    ]);
    
    return { bot, traces, metrics, changeSets, events };
  } catch (error) {
    console.error("Failed to fetch bot data:", error);
    return { bot: null, traces: [], metrics: null, changeSets: [], events: [] };
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'SUCCESS': return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'ERROR': return <XCircle className="w-4 h-4 text-red-500" />;
    case 'PENDING': return <Clock className="w-4 h-4 text-yellow-500" />;
    default: return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
}

export default async function BotDetailPage({ params }: { params: { id: string } }) {
  const { bot, traces, metrics, changeSets, events } = await getBotData(params.id);

  if (!bot) {
    notFound();
  }

  const recentTraces = traces.slice(0, 20);
  const successRate = metrics && metrics.total > 0
    ? Math.round((metrics.success / metrics.total) * 100)
    : 0;
  
  const uptimeHours = Math.floor(bot.uptimeSeconds / 3600);
  const uptimeMinutes = Math.floor((bot.uptimeSeconds % 3600) / 60);

  // Calculate trace type distribution
  const traceTypeStats = traces.reduce((acc, trace) => {
    acc[trace.type] = (acc[trace.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <Link 
          href={bot.fleetId ? `/fleets/${bot.fleetId}` : "/"} 
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Fleet
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{bot.name}</h1>
              <StatusBadge status={bot.status} />
            </div>
            <p className="text-muted-foreground mt-1">
              Bot instance • {bot.id.slice(0, 8)} • Created {new Date(bot.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <RotateCcw className="w-4 h-4 mr-2" />
              Restart
            </Button>
            {bot.status === 'RUNNING' ? (
              <Button variant="outline" size="sm">
                <Pause className="w-4 h-4 mr-2" />
                Stop
              </Button>
            ) : (
              <Button variant="outline" size="sm">
                <Play className="w-4 h-4 mr-2" />
                Start
              </Button>
            )}
            <Button variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap gap-4 mb-8">
        <HealthIndicator health={bot.health} />
        {bot.lastError && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-full text-sm">
            <AlertCircle className="w-4 h-4" />
            Error state
          </div>
        )}
        {bot.errorCount > 0 && (
          <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-sm">
            <AlertCircle className="w-4 h-4" />
            {bot.errorCount} errors
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          title="Uptime"
          value={`${uptimeHours}h ${uptimeMinutes}m`}
          description="Since last restart"
          icon={<Clock className="w-4 h-4" />}
        />
        <MetricCard
          title="Success Rate"
          value={`${successRate}%`}
          description={`${metrics?.success || 0} / ${metrics?.total || 0} requests`}
          icon={<CheckCircle className="w-4 h-4" />}
          className={cn(
            successRate < 90 ? "border-l-4 border-l-red-500" : 
            successRate < 95 ? "border-l-4 border-l-yellow-500" : ""
          )}
        />
        <MetricCard
          title="Avg Latency"
          value={metrics?.avgDuration ? `${Math.round(metrics.avgDuration)}ms` : "N/A"}
          description="Response time"
          icon={<Zap className="w-4 h-4" />}
        />
        <MetricCard
          title="Restarts"
          value={bot.restartCount}
          description="Total restart count"
          icon={<RotateCcw className="w-4 h-4" />}
          className={bot.restartCount > 0 ? "border-l-4 border-l-yellow-500" : ""}
        />
      </div>

      {/* Trace Stats & Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Trace Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Trace Types (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(traceTypeStats)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([type, count]) => (
                  <div key={type} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{type.toLowerCase()}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <Progress 
                      value={traces.length > 0 ? (count / traces.length) * 100 : 0} 
                      className="h-1.5"
                    />
                  </div>
                ))}
              {!Object.keys(traceTypeStats).length && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No traces in last 24 hours
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-2 bg-muted rounded">
                <span className="text-sm">Total Traces</span>
                <span className="font-bold">{metrics?.total || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted rounded">
                <span className="text-sm">Successful</span>
                <span className="font-bold text-green-600">{metrics?.success || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted rounded">
                <span className="text-sm">Failed</span>
                <span className="font-bold text-red-600">{metrics?.error || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted rounded">
                <span className="text-sm">Pending</span>
                <span className="font-bold text-yellow-600">{metrics?.pending || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Activity className="w-4 h-4 text-blue-500" />
                <span>{traces.length} traces in last 24h</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <GitBranch className="w-4 h-4 text-purple-500" />
                <span>{changeSets.length} change sets</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-orange-500" />
                <span>{events.length} deployment events</span>
              </div>
              {bot.lastHealthCheckAt && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-green-500" />
                  <span>Health checked <TimeDisplay date={bot.lastHealthCheckAt} /></span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="traces" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger active>Traces</TabsTrigger>
          <TabsTrigger>Events</TabsTrigger>
          <TabsTrigger>Configuration</TabsTrigger>
          <TabsTrigger>Change Sets</TabsTrigger>
          <TabsTrigger>Logs</TabsTrigger>
        </TabsList>

        <TabsContent active className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Traces</CardTitle>
                  <CardDescription>Last 24 hours of execution traces</CardDescription>
                </div>
                <Link href={`/traces?botInstanceId=${bot.id}`}>
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trace ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTraces.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No traces found for this bot in the last 24 hours.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentTraces.map((trace) => (
                      <TableRow key={trace.id}>
                        <TableCell className="font-mono text-xs">
                          <Link href={`/traces/${trace.traceId}`} className="hover:underline text-primary">
                            {trace.traceId.slice(0, 16)}...
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">{trace.name}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary">
                            {trace.type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {getStatusIcon(trace.status)}
                            <span className={cn(
                              "text-sm",
                              trace.status === 'SUCCESS' && "text-green-600",
                              trace.status === 'ERROR' && "text-red-600",
                              trace.status === 'PENDING' && "text-yellow-600",
                            )}>
                              {trace.status}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {trace.durationMs ? <DurationDisplay ms={trace.durationMs} /> : "-"}
                        </TableCell>
                        <TableCell>
                          <TimeDisplay date={trace.startedAt} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Events</CardTitle>
              <CardDescription>Recent deployment and reconciliation events</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No deployment events found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {events.slice(0, 10).map((event) => (
                    <div key={event.id} className="flex items-start gap-3 pb-4 border-b last:border-0">
                      <div className="mt-0.5">
                        {event.eventType === 'RECONCILE_SUCCESS' ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : event.eventType === 'RECONCILE_ERROR' ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Activity className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{event.eventType}</p>
                        <p className="text-sm text-muted-foreground">{event.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <TimeDisplay date={event.createdAt} />
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Current manifest and settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">Desired Manifest</h3>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-96">
                    {JSON.stringify(bot.desiredManifest, null, 2)}
                  </pre>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-muted rounded">
                    <dt className="text-muted-foreground mb-1">Applied Version</dt>
                    <dd className="font-mono">{bot.appliedManifestVersion || "Not applied"}</dd>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <dt className="text-muted-foreground mb-1">Template</dt>
                    <dd>{bot.templateId || "None"}</dd>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <dt className="text-muted-foreground mb-1">Profile</dt>
                    <dd>{bot.profileId || "None"}</dd>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <dt className="text-muted-foreground mb-1">ECS Service</dt>
                    <dd className="font-mono truncate">{bot.ecsServiceArn || "Not configured"}</dd>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Change Sets</CardTitle>
                  <CardDescription>Configuration changes for this bot</CardDescription>
                </div>
                <Link href={`/changesets?botInstanceId=${bot.id}`}>
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changeSets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No change sets found for this bot.
                      </TableCell>
                    </TableRow>
                  ) : (
                    changeSets.slice(0, 10).map((cs) => (
                      <TableRow key={cs.id}>
                        <TableCell className="capitalize">{cs.changeType.toLowerCase()}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{cs.description}</TableCell>
                        <TableCell>
                          <StatusBadge status={cs.status} />
                        </TableCell>
                        <TableCell className="capitalize">
                          {cs.rolloutStrategy.toLowerCase()}
                          {cs.rolloutPercentage && ` (${cs.rolloutPercentage}%)`}
                        </TableCell>
                        <TableCell>
                          {cs.totalInstances > 0 && (
                            <div className="w-[80px]">
                              <Progress 
                                value={((cs.updatedInstances + cs.failedInstances) / cs.totalInstances) * 100} 
                                className="h-1.5"
                              />
                              <span className="text-xs text-muted-foreground">
                                {cs.updatedInstances + cs.failedInstances}/{cs.totalInstances}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <TimeDisplay date={cs.createdAt} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                Logs
              </CardTitle>
              <CardDescription>Bot execution logs</CardDescription>
            </CardHeader>
            <CardContent>
              {bot.cloudwatchLogGroup ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Logs are stored in CloudWatch. Click below to view them in the AWS Console.
                  </p>
                  <a 
                    href={`https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups/log-group/${encodeURIComponent(bot.cloudwatchLogGroup)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                  >
                    View logs in CloudWatch
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Terminal className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No log group configured for this bot.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Last Error Alert */}
      {bot.lastError && (
        <Card className="mt-8 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Last Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-red-700 text-sm whitespace-pre-wrap overflow-auto max-h-48">{bot.lastError}</pre>
            <p className="text-red-600 text-xs mt-2">
              Error count: {bot.errorCount}
            </p>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
