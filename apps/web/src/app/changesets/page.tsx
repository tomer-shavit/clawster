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
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { TimeDisplay } from "@/components/ui/time-display";
import { api, type ChangeSet } from "@/lib/api";
import Link from "next/link";
import { 
  Search, 
  Filter, 
  FileText, 
  GitCommit, 
  ArrowRight, 
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

async function getChangeSets(searchParams: { [key: string]: string | undefined }): Promise<ChangeSet[]> {
  try {
    return await api.listChangeSets({
      botInstanceId: searchParams.botInstanceId,
      status: searchParams.status,
    });
  } catch (error) {
    console.error("Failed to fetch change sets:", error);
    return [];
  }
}

function getStrategyBadge(strategy: string, percentage?: number) {
  const styles = {
    ALL: "bg-blue-100 text-blue-800",
    PERCENTAGE: "bg-purple-100 text-purple-800",
    CANARY: "bg-orange-100 text-orange-800",
  };
  
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", styles[strategy as keyof typeof styles] || "bg-gray-100")}>
      {strategy === "ALL" && "All Instances"}
      {strategy === "PERCENTAGE" && `Percentage (${percentage}%)`}
      {strategy === "CANARY" && "Canary"}
    </span>
  );
}

export default async function ChangeSetsPage({ 
  searchParams 
}: { 
  searchParams: { [key: string]: string | undefined } 
}) {
  const changeSets = await getChangeSets(searchParams);

  // Calculate stats
  const pendingCount = changeSets.filter(cs => cs.status === 'PENDING').length;
  const inProgressCount = changeSets.filter(cs => cs.status === 'IN_PROGRESS').length;
  const completedCount = changeSets.filter(cs => cs.status === 'COMPLETED').length;
  const failedCount = changeSets.filter(cs => cs.status === 'FAILED').length;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Change Sets</h1>
          <p className="text-muted-foreground mt-1">
            Manage configuration changes and rollouts
          </p>
        </div>
        <Link href="/changesets/new">
          <Button>
            <GitCommit className="w-4 h-4 mr-2" />
            New Change Set
          </Button>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{inProgressCount}</p>
              </div>
              <Play className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{completedCount}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold">{failedCount}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search change sets..."
                  className="pl-8"
                />
              </div>
            </div>
            <div className="w-[150px]">
              <Select defaultValue={searchParams.status || "all"}>
                <option value="all">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
                <option value="ROLLED_BACK">Rolled Back</option>
              </Select>
            </div>
            <div className="w-[150px]">
              <Select defaultValue="all">
                <option value="all">All Types</option>
                <option value="UPDATE">Update</option>
                <option value="ROLLOUT">Rollout</option>
                <option value="ROLLBACK">Rollback</option>
              </Select>
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change Sets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Change Sets</CardTitle>
          <CardDescription>{changeSets.length} change sets found</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Bot</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changeSets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No change sets found.</p>
                    <Link href="/changesets/new">
                      <Button className="mt-4">Create your first change set</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ) : (
                changeSets.map((cs) => {
                  const progress = cs.totalInstances > 0 
                    ? Math.round(((cs.updatedInstances + cs.failedInstances) / cs.totalInstances) * 100)
                  : 0;
                  
                  return (
                    <TableRow key={cs.id} className={cn(
                      cs.status === 'IN_PROGRESS' && "bg-blue-50/50"
                    )}>
                      <TableCell className="font-mono text-xs">
                        {cs.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {cs.botInstance ? (
                          <Link 
                            href={`/bots/${cs.botInstance.id}`}
                            className="hover:underline text-sm font-medium"
                          >
                            {cs.botInstance.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{cs.changeType.toLowerCase()}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {cs.description}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={cs.status} />
                      </TableCell>
                      <TableCell>
                        <div className="w-[100px]">
                          <Progress value={progress} className="h-2" />
                          <span className="text-xs text-muted-foreground">
                            {cs.updatedInstances + cs.failedInstances}/{cs.totalInstances}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStrategyBadge(cs.rolloutStrategy, cs.rolloutPercentage)}
                      </TableCell>
                      <TableCell>
                        <TimeDisplay date={cs.createdAt} />
                      </TableCell>
                      <TableCell>
                        <Link href={`/changesets/${cs.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                            <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quick Help */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">About Change Sets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                All Instances
              </h4>
              <p className="text-muted-foreground">
                Updates all bot instances simultaneously. Fastest but riskiest option.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-purple-500" />
                Percentage Rollout
              </h4>
              <p className="text-muted-foreground">
                Gradually roll out to a percentage of instances. Good for testing changes.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                Canary
              </h4>
              <p className="text-muted-foreground">
                Deploy to specific canary instances first. Safest option for critical changes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
