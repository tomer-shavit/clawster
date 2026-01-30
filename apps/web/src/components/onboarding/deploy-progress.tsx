"use client";

import { ProvisioningScreen } from "@/components/provisioning/provisioning-screen";

interface DeployProgressProps {
  instanceId: string;
  botName?: string;
  onRetry?: () => void;
}

export function DeployProgress({ instanceId, botName, onRetry }: DeployProgressProps) {
  return <ProvisioningScreen instanceId={instanceId} instanceName={botName} onRetry={onRetry} />;
}
