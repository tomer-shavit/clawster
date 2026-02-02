export const dynamic = 'force-dynamic';

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { api, type BotInstance, type Fleet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Bot, Rocket, Activity, AlertTriangle, HeartPulse } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { BotsListClient } from "./bots-list-client";

async function getBots(): Promise<BotInstance[]> {
  try {
    return await api.listBotInstances();
  } catch {
    return [];
  }
}

async function getFleets(): Promise<Fleet[]> {
  try {
    return await api.listFleets();
  } catch {
    return [];
  }
}

interface SummaryCardProps {
  label: string;
  count: number;
  icon: React.ReactNode;
  color: string;
}

function SummaryCard({ label, count, icon, color }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{count}</p>
          </div>
          <div className={`p-3 rounded-full bg-muted`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function BotsPage() {
  const [bots, fleets] = await Promise.all([getBots(), getFleets()]);

  const runningCount = bots.filter((b) => b.status === "RUNNING").length;
  const errorCount = bots.filter((b) => b.status === "ERROR" || b.status === "DEGRADED").length;
  const unhealthyCount = bots.filter((b) => b.health === "UNHEALTHY" || b.health === "DEGRADED").length;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bot Instances</h1>
          <p className="text-muted-foreground mt-1">
            Manage your bot instances
          </p>
        </div>
        <Link href="/bots/new">
          <Button>
            <Bot className="w-4 h-4 mr-2" />
            New Bot
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <SummaryCard
          label="Total"
          count={bots.length}
          icon={<Bot className="w-5 h-5 text-muted-foreground" />}
          color="text-foreground"
        />
        <SummaryCard
          label="Running"
          count={runningCount}
          icon={<Activity className="w-5 h-5 text-green-600" />}
          color="text-green-600"
        />
        <SummaryCard
          label="Errors"
          count={errorCount}
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          color="text-red-600"
        />
        <SummaryCard
          label="Unhealthy"
          count={unhealthyCount}
          icon={<HeartPulse className="w-5 h-5 text-amber-600" />}
          color="text-amber-600"
        />
      </div>

      {bots.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Rocket}
              title="No bots deployed yet"
              description="Deploy your first OpenClaw agent to get started."
              action={{ label: "Deploy a Bot", href: "/bots/new" }}
            />
          </CardContent>
        </Card>
      ) : (
        <BotsListClient initialBots={bots} fleets={fleets} />
      )}
    </DashboardLayout>
  );
}
