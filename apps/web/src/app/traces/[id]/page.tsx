"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimeDisplay, DurationDisplay } from "@/components/ui/time-display";
import { Progress } from "@/components/ui/progress";
import { api, type Trace } from "@/lib/api";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  ChevronRight,
  ChevronDown,
  Copy,
  FileJson,
  ArrowRightLeft,
  User,
  Bot,
  MessageSquare,
  Regex
} from "lucide-react";

function isDelegationTrace(trace: Trace): boolean {
  return (
    trace.type === 'TASK' &&
    trace.metadata != null &&
    (trace.metadata as Record<string, unknown>).delegationType === 'delegation'
  );
}

function getDelegationMeta(trace: Trace) {
  const m = trace.metadata as Record<string, unknown> | undefined;
  if (!m) return null;
  return {
    sourceBotId: (m.sourceBotId as string) || '',
    sourceBotName: (m.sourceBotName as string) || 'Unknown',
    targetBotId: (m.targetBotId as string) || '',
    targetBotName: (m.targetBotName as string) || 'Unknown',
    triggerPattern: (m.triggerPattern as string) || '',
    originalMessage: (m.originalMessage as string) || '',
  };
}

function isA2aTrace(trace: Trace): boolean {
  return (
    trace.metadata != null &&
    (trace.metadata as Record<string, unknown>).a2a === true
  );
}

function DelegationChainVisualization({ trace }: { trace: Trace }) {
  const meta = getDelegationMeta(trace);
  if (!meta) return null;

  const hasResponse = trace.status === 'SUCCESS' && trace.output != null;
  const outputText = hasResponse
    ? typeof (trace.output as Record<string, unknown>)?.response === 'string'
      ? (trace.output as Record<string, unknown>).response as string
      : JSON.stringify(trace.output, null, 2)
    : null;

  const a2aChild = (trace as any).children?.find((c: Trace) => isA2aTrace(c)) ?? null;

  return (
    <Card className="border-violet-200 bg-violet-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-violet-900">
          <ArrowRightLeft className="w-5 h-5" />
          Delegation Flow
        </CardTitle>
        <CardDescription>
          Bot-to-bot delegation chain for this trace
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Chain visualization */}
        <div className="flex flex-col items-stretch gap-0">
          {/* Step 1: User sends message */}
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border-2 border-blue-300">
                <User className="w-5 h-5 text-blue-700" />
              </div>
              <div className="w-0.5 h-8 bg-violet-300" />
            </div>
            <div className="pt-1.5 flex-1">
              <p className="text-sm font-medium text-foreground">User Message</p>
              {meta.originalMessage && (
                <p className="text-sm text-muted-foreground mt-1 bg-white rounded px-3 py-2 border">
                  &ldquo;{meta.originalMessage}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Step 2: Source bot receives and delegates */}
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center border-2 border-violet-400">
                <Bot className="w-5 h-5 text-violet-700" />
              </div>
              <div className="w-0.5 h-8 bg-violet-300" />
            </div>
            <div className="pt-1.5 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{meta.sourceBotName}</p>
                <Badge variant="secondary" className="text-xs">Source Bot</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Matched trigger pattern and delegated to target bot
              </p>
              {meta.triggerPattern && (
                <div className="flex items-center gap-2 mt-2 bg-white rounded px-3 py-2 border text-xs">
                  <Regex className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                  <span className="text-muted-foreground">Trigger pattern:</span>
                  <code className="font-mono text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">{meta.triggerPattern}</code>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Target bot processes */}
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center border-2 border-emerald-400">
                <Bot className="w-5 h-5 text-emerald-700" />
              </div>
              {hasResponse && <div className="w-0.5 h-8 bg-violet-300" />}
            </div>
            <div className="pt-1.5 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{meta.targetBotName}</p>
                <Badge variant="secondary" className="text-xs">Target Bot</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Received delegated message and processed it
              </p>
            </div>
          </div>

          {/* Step 3.5: A2A Task (if child A2A trace exists) */}
          {a2aChild && (
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border-2 border-blue-300">
                  <MessageSquare className="w-5 h-5 text-blue-700" />
                </div>
                {(hasResponse || trace.status === 'ERROR') && <div className="w-0.5 h-8 bg-violet-300" />}
              </div>
              <div className="pt-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">A2A Task</p>
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border border-blue-200">
                    {a2aChild.status === 'SUCCESS' ? 'Completed' : a2aChild.status === 'ERROR' ? 'Failed' : 'Pending'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Message sent via A2A protocol to target bot
                </p>
                {a2aChild.durationMs != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Duration: <DurationDisplay ms={a2aChild.durationMs} />
                  </p>
                )}
                <Link href={`/traces/${a2aChild.traceId}`} className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                  View A2A trace details →
                </Link>
              </div>
            </div>
          )}

          {/* Step 4: Response (if available) */}
          {hasResponse && (
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center border-2 border-green-300">
                  <MessageSquare className="w-5 h-5 text-green-700" />
                </div>
              </div>
              <div className="pt-1.5 flex-1">
                <p className="text-sm font-medium text-foreground">Response</p>
                {outputText && (
                  <pre className="text-sm text-muted-foreground mt-1 bg-white rounded px-3 py-2 border whitespace-pre-wrap break-words max-h-48 overflow-auto">
                    {outputText}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Error display for failed delegations */}
          {trace.status === 'ERROR' && (
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center border-2 border-red-300">
                  <XCircle className="w-5 h-5 text-red-700" />
                </div>
              </div>
              <div className="pt-1.5 flex-1">
                <p className="text-sm font-medium text-red-700">Delegation Failed</p>
                {trace.error && (
                  <pre className="text-sm text-red-600 mt-1 bg-red-50 rounded px-3 py-2 border border-red-200 whitespace-pre-wrap break-words">
                    {JSON.stringify(trace.error, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Summary table */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm border-t border-violet-200 pt-4">
          <div>
            <span className="text-muted-foreground">Source Bot</span>
            <p className="font-medium mt-0.5">{meta.sourceBotName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Target Bot</span>
            <p className="font-medium mt-0.5">{meta.targetBotName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Trigger Pattern</span>
            <p className="font-mono text-xs mt-0.5">{meta.triggerPattern || 'N/A'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Duration</span>
            <p className="font-medium mt-0.5">
              {trace.durationMs ? <DurationDisplay ms={trace.durationMs} /> : 'N/A'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Protocol</span>
            <p className="font-medium mt-0.5">{a2aChild ? 'A2A' : 'Direct Gateway'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TraceTreeNodeProps {
  trace: Trace & { children?: Trace[] };
  level?: number;
  totalDuration: number;
}

function TraceTreeNode({ trace, level = 0, totalDuration }: TraceTreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = trace.children && trace.children.length > 0;
  const percentage = totalDuration > 0 && trace.durationMs 
    ? (trace.durationMs / totalDuration) * 100 
    : 0;

  return (
    <div className="select-none">
      <div 
        className="flex items-center gap-2 py-2 hover:bg-accent/50 rounded px-2 cursor-pointer"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> 
                 : <ChevronRight className="w-4 h-4 text-muted-foreground" />
        ) : (
          <span className="w-4" />
        )}
        
        {trace.status === 'SUCCESS' ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : trace.status === 'ERROR' ? (
          <XCircle className="w-4 h-4 text-red-500" />
        ) : (
          <Clock className="w-4 h-4 text-yellow-500" />
        )}
        
        <span className="text-sm font-medium">{trace.name}</span>
        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-secondary">
          {trace.type}
        </span>
        {isDelegationTrace(trace) && (
          <span className="text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700 border border-violet-200 flex items-center gap-1">
            <ArrowRightLeft className="w-3 h-3" />
            {(() => {
              const m = getDelegationMeta(trace);
              return m ? `${m.sourceBotName} \u2192 ${m.targetBotName}` : 'Delegation';
            })()}
          </span>
        )}
        {isA2aTrace(trace) && (
          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            A2A
          </span>
        )}

        <div className="flex-1" />
        
        {trace.durationMs && (
          <DurationDisplay ms={trace.durationMs} />
        )}
      </div>
      
      {percentage > 0 && (
        <div style={{ paddingLeft: `${level * 20 + 28}px` }} className="mb-1">
          <div className="flex items-center gap-2">
            <Progress value={percentage} className="h-1 flex-1" />
            <span className="text-xs text-muted-foreground w-10 text-right">
              {percentage.toFixed(1)}%
            </span>
          </div>
        </div>
      )}
      
      {expanded && hasChildren && (
        <div>
          {trace.children!.map((child) => (
            <TraceTreeNode 
              key={child.id} 
              trace={child} 
              level={level + 1}
              totalDuration={totalDuration}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TraceDetailPage({ params }: { params: { id: string } }) {
  const [trace, setTrace] = useState<(Trace & { children?: Trace[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTrace() {
      try {
        const data = await api.getTraceTree(params.id);
        setTrace(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load trace");
      } finally {
        setLoading(false);
      }
    }
    loadTrace();
  }, [params.id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !trace) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <XCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold">Trace not found</h2>
          <p className="text-muted-foreground mt-2">{error || "The trace could not be loaded"}</p>
          <Link href="/traces">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Traces
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const totalDuration = trace.durationMs || 0;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <Link 
          href="/traces" 
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Traces
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{trace.name}</h1>
              {isDelegationTrace(trace) && (
                <Badge variant="outline" className="border-violet-300 text-violet-700 bg-violet-50">
                  <ArrowRightLeft className="w-3 h-3 mr-1" />
                  Delegation
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              Trace ID: <code className="bg-muted px-1 rounded">{trace.traceId}</code>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Copy className="w-4 h-4 mr-2" />
              Copy ID
            </Button>
            <Button variant="outline" size="sm">
              <FileJson className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>
            {trace.status === 'SUCCESS' ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">Success</span>
              </div>
            ) : trace.status === 'ERROR' ? (
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="w-5 h-5" />
                <span className="font-semibold">Error</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-600">
                <Clock className="w-5 h-5" />
                <span className="font-semibold">Pending</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Duration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <span className="font-semibold">
                {trace.durationMs ? <DurationDisplay ms={trace.durationMs} /> : "-"}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-muted-foreground" />
              <span className="font-semibold">{trace.type}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Started</CardDescription>
          </CardHeader>
          <CardContent>
            <TimeDisplay date={trace.startedAt} format="absolute" />
          </CardContent>
        </Card>
      </div>

      {/* Delegation Chain Visualization */}
      {isDelegationTrace(trace) && (
        <div className="mb-8">
          <DelegationChainVisualization trace={trace} />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="tree" className="w-full">
        <TabsList>
          <TabsTrigger active>Trace Tree</TabsTrigger>
          <TabsTrigger>Input</TabsTrigger>
          <TabsTrigger>Output</TabsTrigger>
          <TabsTrigger>Metadata</TabsTrigger>
        </TabsList>

        <TabsContent active className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Execution Trace Tree</CardTitle>
              <CardDescription>End-to-end execution flow with latency breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <TraceTreeNode trace={trace} totalDuration={totalDuration} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Input</CardTitle>
              <CardDescription>Request input parameters</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto">
                {JSON.stringify(trace.input, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Output</CardTitle>
              <CardDescription>Response output data</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto">
                {JSON.stringify(trace.output, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
              <CardDescription>Additional trace metadata and tags</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Metadata</h4>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto">
                    {JSON.stringify(trace.metadata, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Tags</h4>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto">
                    {JSON.stringify(trace.tags, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Error Display */}
      {trace.error && (
        <Card className="mt-8 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              Error Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-red-700 text-sm whitespace-pre-wrap">
              {JSON.stringify(trace.error, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
