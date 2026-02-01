export const dynamic = "force-dynamic";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { api, type BotRoutingRule, type BotInstance } from "@/lib/api";
import { RoutingRulesClient } from "./routing-rules-client";

async function getRoutingRules(): Promise<BotRoutingRule[]> {
  try {
    return await api.listRoutingRules();
  } catch (error) {
    console.error("Failed to fetch routing rules:", error);
    return [];
  }
}

async function getBots(): Promise<BotInstance[]> {
  try {
    return await api.listBotInstances();
  } catch (error) {
    console.error("Failed to fetch bot instances:", error);
    return [];
  }
}

export default async function RoutingPage() {
  const [rules, bots] = await Promise.all([getRoutingRules(), getBots()]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Routing Rules</h1>
          <p className="text-muted-foreground mt-1">
            Configure inter-bot message routing. When a message matches a
            trigger pattern, it is forwarded from the source bot to the target
            bot.
          </p>
        </div>
      </div>

      <RoutingRulesClient initialRules={rules} bots={bots} />
    </DashboardLayout>
  );
}
