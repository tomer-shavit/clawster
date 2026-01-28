export const dynamic = 'force-dynamic';

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { TimeDisplay, DurationDisplay } from "@/components/ui/time-display";
import { api, type Trace } from "@/lib/api";
import Link from "next/link";
import { 
  Search, 
  Filter, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Activity,
  Zap,
  GitBranch,
  ArrowRight,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";

async function getTraces(searchParams: { [key: string]: string | undefined }): Promise<Trace[]> {
  try {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    return await api.listTraces({
      botInstanceId: searchParams.botInstanceId,
      type: searchParams.type,
      status: searchParams.status,
      from,
      to,
      limit: 100,
    });
  } catch (error) {
    console.error("Failed to fetch traces:", error);
    return [];
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

function getTypeIcon(type: string) {
  switch (type) {
    case 'REQUEST': return <Zap className="w-4 h-4 text-blue-500" />;
    case 'TASK': return <Activity className="w-4 h-4 text-purple-500" />;
    case 'SKILL': return <GitBranch className="w-4 h-4 text-orange-500" />;
    case 'TOOL': return <BarChart3 className="w-4 h-4 text-green-500" />;
    case 'MODEL': return <Activity className="w-4 h-4 text-pink-500" />;
    default: return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
}

export default async function TracesPage({ 
  searchParams 
}: { 
  searchParams: { [key: string]: string | undefined } 
}) {
  const traces = await getTraces(searchParams);

  // Calculate stats
  const totalTraces = traces.length;
  const successCount = traces.filter(t => t.status === 'SUCCESS').length;
  const errorCount = traces.filter(t => t.status === 'ERROR').length;
  const pendingCount = traces.filter(t => t.status === 'PENDING').length;
  
  const avgDuration = traces.length > 0
    ? Math.round(traces.reduce((sum, t) => sum + (t.durationMs || 0), 0) / traces.length)
    : 0;

  // Get type distribution
  const typeStats = traces.reduce((acc, trace) => {
    acc[trace.type] = (acc[trace.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trace Viewer</h1>
          <p className="text-muted-foreground mt-1">
            End-to-end message trace visualization
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-5 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Traces</p>
                <p className="text-2xl font-bold">{totalTraces}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success</p>
                <p className="text-2xl font-bold text-green-600">{successCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-red-600">{errorCount}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">
                  {avgDuration > 0 ? <DurationDisplay ms={avgDuration} /> : "N/A"}
                </p>
              </div>
              <Zap className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar with Filters and Stats */}
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Status</label>
                <Select defaultValue={searchParams.status || "all"}>
                  <option value="all">All Statuses</option>
                  <option value="SUCCESS">Success</option>
                  <option value="ERROR">Error</option>
                  <option value="PENDING">Pending</option>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Type</label>
                <Select defaultValue={searchParams.type || "all"}>
                  <option value="all">All Types</option>
                  <option value="REQUEST">Request</option>
                  <option value="TASK">Task</option>
                  <option value="SKILL">Skill</option>
                  <option value="TOOL">Tool</option>
                  <option value="MODEL">Model</option>
                </Select>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search traces..."
                  className="pl-8"
                />
              </div>
              <Button variant="outline" className="w-full">
                <Filter className="w-4 h-4 mr-2" />
                Apply Filters
              </Button>
            </CardContent>
          </Card>

          {/* Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Type Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(typeStats)
                  .sort(([,a], [,b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(type)}
                        <span className="text-sm capitalize">{type.toLowerCase()}</span>
                      </div>
                      <span className="font-medium text-sm">{count}</span>
                    </div>
                  ))}
                {!Object.keys(typeStats).length && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No data
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Traces Table */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Traces</CardTitle>
              <CardDescription>{traces.length} traces found</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trace ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Bot</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {traces.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No traces found matching your criteria.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    traces.map((trace) => (
                      <TableRow key={trace.id}>
                        <TableCell className="font-mono text-xs">
                          {trace.traceId.slice(0, 20)}...
                        </TableCell>
                        <TableCell className="font-medium">{trace.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTypeIcon(trace.type)}
                            <span className="text-xs capitalize">{trace.type.toLowerCase()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {trace.botInstance ? (
                            <Link 
                              href={`/bots/${trace.botInstance.id}`}
                              className="hover:underline text-sm"
                            >
                              {trace.botInstance.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
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
                        <TableCell>
                          <Link href={`/traces/${trace.traceId}`}>
                            <Button variant="ghost" size="sm">
                              View
                              <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
