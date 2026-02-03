"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Cpu,
  HardDrive,
  MemoryStick,
  Zap,
  Lightbulb,
  Rocket,
  Settings,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  api,
  type BotInstance,
  type BotResourcesResponse,
  type ResourceTier,
} from "@/lib/api";
import { useProvisioningEvents } from "@/hooks/use-provisioning-events";
import { StepProgress } from "@/components/provisioning/step-progress";
import { DeployTerminal } from "@/components/provisioning/deploy-terminal";

interface ResourceManagementProps {
  bot: BotInstance;
  className?: string;
}

interface TierOption {
  tier: ResourceTier;
  name: string;
  icon: React.ReactNode;
  description: string;
  features: string[];
  priceRange: string;
  cpu: number;
  memory: number;
  disk: number;
}

const TIER_OPTIONS: TierOption[] = [
  {
    tier: "light",
    name: "Light",
    icon: <Lightbulb className="w-5 h-5" />,
    description: "Basic bots with low traffic",
    features: ["1-2 channels", "Low traffic", "Basic automation"],
    priceRange: "~$5-10/mo",
    cpu: 512,
    memory: 1024,
    disk: 5,
  },
  {
    tier: "standard",
    name: "Standard",
    icon: <Zap className="w-5 h-5" />,
    description: "Multi-channel bots with moderate traffic",
    features: ["Multi-channel", "WhatsApp included", "Moderate traffic"],
    priceRange: "~$15-25/mo",
    cpu: 1024,
    memory: 2048,
    disk: 10,
  },
  {
    tier: "performance",
    name: "Performance",
    icon: <Rocket className="w-5 h-5" />,
    description: "Full-featured bots with high traffic",
    features: ["All features", "Sandbox mode", "Voice/Browser", "High traffic"],
    priceRange: "~$40-80/mo",
    cpu: 2048,
    memory: 4096,
    disk: 20,
  },
];

const SUPPORTED_DEPLOYMENT_TYPES = ["ecs-ec2", "gce", "azure-vm", "ECS_EC2", "GCE", "AZURE_VM"];

export function ResourceManagement({ bot, className }: ResourceManagementProps) {
  const [resources, setResources] = useState<BotResourcesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<ResourceTier | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  // Provisioning events for real-time log streaming during resource updates
  const { progress, logs, isConnected } = useProvisioningEvents(
    isUpdating ? bot.id : null // Only subscribe when updating
  );

  // Custom tier state
  const [customCpu, setCustomCpu] = useState(1024);
  const [customMemory, setCustomMemory] = useState(2048);
  const [customDisk, setCustomDisk] = useState(10);
  const [showCustom, setShowCustom] = useState(false);

  const fetchResources = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getBotResources(bot.id);
      setResources(data);
      setSelectedTier(data.tier);
      if (data.tier === "custom") {
        setShowCustom(true);
        setCustomCpu(data.cpu);
        setCustomMemory(data.memory);
        setCustomDisk(data.dataDiskSizeGb ?? 10);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resources");
    } finally {
      setIsLoading(false);
    }
  }, [bot.id]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const deploymentType = bot.deploymentType ?? bot.deploymentTarget?.type ?? "docker";
  const isSupported = SUPPORTED_DEPLOYMENT_TYPES.includes(deploymentType);

  const handleTierSelect = (tier: ResourceTier) => {
    if (tier === "custom") {
      setShowCustom(true);
    } else {
      setShowCustom(false);
    }
    setSelectedTier(tier);
    setUpdateResult(null);
  };

  const handleChangePlan = () => {
    if (!selectedTier) return;
    setShowConfirmDialog(true);
  };

  const handleConfirmChange = async () => {
    setShowConfirmDialog(false);
    setIsUpdating(true);
    setUpdateResult(null);
    setShowLogs(true); // Show logs terminal during update

    try {
      const payload = selectedTier === "custom"
        ? { tier: "custom" as const, cpu: customCpu, memory: customMemory, dataDiskSizeGb: customDisk }
        : { tier: selectedTier! };

      const result = await api.updateBotResources(bot.id, payload);
      setUpdateResult(result);

      if (result.success) {
        await fetchResources();
      }
    } catch (err) {
      setUpdateResult({
        success: false,
        message: err instanceof Error ? err.message : "Update failed",
      });
    } finally {
      setIsUpdating(false);
      // Keep logs visible for a moment after completion so user can see final state
    }
  };

  const getTierByName = (tier: ResourceTier): TierOption | undefined => {
    return TIER_OPTIONS.find((t) => t.tier === tier);
  };

  const currentTier = resources ? getTierByName(resources.tier) : undefined;
  const hasChanges = selectedTier !== resources?.tier ||
    (selectedTier === "custom" && resources?.tier === "custom" &&
      (customCpu !== resources.cpu || customMemory !== resources.memory || customDisk !== (resources.dataDiskSizeGb ?? 10)));

  // Feature recommendations based on bot config
  const getRecommendations = () => {
    const recommendations: string[] = [];
    const config = bot.desiredManifest as Record<string, unknown>;
    const channels = config?.channels as Record<string, unknown> | undefined;
    const agents = config?.agents as Record<string, unknown> | undefined;
    const sandbox = agents?.defaults as Record<string, unknown> | undefined;

    if (channels?.whatsapp && resources?.tier === "light") {
      recommendations.push("WhatsApp enabled - Consider upgrading memory for session persistence");
    }

    if (sandbox?.sandbox && (sandbox.sandbox as Record<string, unknown>)?.mode !== "off" && resources?.tier !== "performance") {
      recommendations.push("Sandbox enabled - Performance tier recommended for Docker-in-Docker");
    }

    if (Object.keys(channels ?? {}).length > 3 && resources?.tier === "light") {
      recommendations.push("Multiple channels configured - Standard tier may provide better stability");
    }

    return recommendations;
  };

  const recommendations = resources ? getRecommendations() : [];

  if (!isSupported) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5" />
            Resources
          </CardTitle>
          <CardDescription>
            Resource management is not available for {deploymentType} deployments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span>
              Resource updates are only supported for ECS, GCE, and Azure VM deployment targets.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5" />
            Resources
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5" />
            Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" className="mt-4" onClick={fetchResources}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className={cn("space-y-6", className)}>
        {/* Current Resources */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="w-5 h-5" />
                  Current Resources
                </CardTitle>
                <CardDescription>
                  {currentTier ? `${currentTier.name} Plan` : "Custom Configuration"}
                </CardDescription>
              </div>
              {currentTier && (
                <Badge variant="secondary" className="text-sm">
                  {currentTier.priceRange}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Cpu className="w-4 h-4" />
                  CPU
                </div>
                <div className="text-2xl font-semibold">
                  {resources?.cpu ?? 0}
                  <span className="text-sm text-muted-foreground ml-1">units</span>
                </div>
                <Progress value={((resources?.cpu ?? 0) / 4096) * 100} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MemoryStick className="w-4 h-4" />
                  Memory
                </div>
                <div className="text-2xl font-semibold">
                  {((resources?.memory ?? 0) / 1024).toFixed(1)}
                  <span className="text-sm text-muted-foreground ml-1">GB</span>
                </div>
                <Progress value={((resources?.memory ?? 0) / 8192) * 100} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <HardDrive className="w-4 h-4" />
                  Disk
                </div>
                <div className="text-2xl font-semibold">
                  {resources?.dataDiskSizeGb ?? "-"}
                  <span className="text-sm text-muted-foreground ml-1">GB</span>
                </div>
                <Progress value={((resources?.dataDiskSizeGb ?? 0) / 100) * 100} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2">
                {recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                    <span className="mt-1">-</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Plan Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Change Plan
            </CardTitle>
            <CardDescription>
              Select a resource tier that fits your needs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {TIER_OPTIONS.map((option) => (
                <div
                  key={option.tier}
                  className={cn(
                    "p-4 rounded-lg border-2 cursor-pointer transition-all",
                    selectedTier === option.tier
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => handleTierSelect(option.tier)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {option.icon}
                    <span className="font-semibold">{option.name}</span>
                    {resources?.tier === option.tier && (
                      <Badge variant="secondary" className="text-xs ml-auto">Current</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{option.description}</p>
                  <ul className="text-xs space-y-1 mb-3">
                    {option.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="text-sm font-medium text-muted-foreground">
                    {option.priceRange}
                  </div>
                </div>
              ))}
            </div>

            {/* Custom Configuration */}
            <div
              className={cn(
                "p-4 rounded-lg border-2 cursor-pointer transition-all mb-6",
                selectedTier === "custom"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
              onClick={() => handleTierSelect("custom")}
            >
              <div className="flex items-center gap-2 mb-2">
                <Settings className="w-5 h-5" />
                <span className="font-semibold">Custom</span>
                {resources?.tier === "custom" && (
                  <Badge variant="secondary" className="text-xs ml-auto">Current</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Define your own resource allocation
              </p>

              {showCustom && (
                <div className="grid grid-cols-3 gap-4 mt-4" onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-2">
                    <label htmlFor="cpu" className="text-sm font-medium">CPU (units)</label>
                    <Input
                      id="cpu"
                      type="number"
                      min={256}
                      max={4096}
                      step={256}
                      value={customCpu}
                      onChange={(e) => setCustomCpu(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="memory" className="text-sm font-medium">Memory (MiB)</label>
                    <Input
                      id="memory"
                      type="number"
                      min={512}
                      max={30720}
                      step={512}
                      value={customMemory}
                      onChange={(e) => setCustomMemory(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="disk" className="text-sm font-medium">Data Disk (GB)</label>
                    <Input
                      id="disk"
                      type="number"
                      min={5}
                      max={100}
                      step={5}
                      value={customDisk}
                      onChange={(e) => setCustomDisk(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Update Result */}
            {updateResult && (
              <div
                className={cn(
                  "p-4 rounded-lg mb-4",
                  updateResult.success
                    ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900"
                    : "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900"
                )}
              >
                <div className="flex items-center gap-2">
                  {updateResult.success ? (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  )}
                  <span
                    className={
                      updateResult.success
                        ? "text-green-700 dark:text-green-300"
                        : "text-red-700 dark:text-red-300"
                    }
                  >
                    {updateResult.message}
                  </span>
                </div>
              </div>
            )}

            {/* Progress & Logs during resource update */}
            {(isUpdating || (showLogs && logs.length > 0)) && (
              <div className="mb-4 space-y-4">
                {/* Step Progress */}
                {progress && progress.steps.length > 0 && (
                  <div className="space-y-0">
                    {progress.steps.map((step, i) => (
                      <StepProgress
                        key={step.id}
                        step={step}
                        isLast={i === progress.steps.length - 1}
                      />
                    ))}
                  </div>
                )}

                {/* Logs Terminal */}
                <div className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-2 bg-muted/50 hover:bg-muted transition-colors"
                    onClick={() => setShowLogs(!showLogs)}
                  >
                    <span className="text-sm font-medium flex items-center gap-2">
                      Logs
                      {isConnected && (
                        <Badge variant="secondary" className="text-xs">Live</Badge>
                      )}
                    </span>
                    {showLogs ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  {showLogs && (
                    <DeployTerminal
                      logs={logs}
                      status={isUpdating ? "in_progress" : progress?.status}
                    />
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={handleChangePlan}
              disabled={!hasChanges || isUpdating}
              className="w-full"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating Resources...
                </>
              ) : (
                "Apply Changes"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          onKeyDown={(e) => { if (e.key === "Escape") setShowConfirmDialog(false); }}
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowConfirmDialog(false)}
          />

          {/* Dialog */}
          <div className="relative z-50 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 id="confirm-dialog-title" className="text-lg font-semibold">
                Change Resource Allocation?
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowConfirmDialog(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-sm text-muted-foreground mb-6">
              {selectedTier === "custom" ? (
                <>
                  You are about to change to a custom configuration:
                  <br />
                  CPU: {customCpu} units, Memory: {customMemory} MiB, Disk: {customDisk} GB
                </>
              ) : (
                <>
                  You are about to change to the{" "}
                  <strong className="text-foreground">{getTierByName(selectedTier!)?.name}</strong> plan.
                </>
              )}
              <br />
              <br />
              <strong className="text-foreground">Note:</strong> This operation may require a brief restart of your bot
              (typically 60-90 seconds). Your bot will be unavailable during this time.
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmChange}>
                Confirm Change
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
