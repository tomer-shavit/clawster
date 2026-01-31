"use client";

import { ChannelSetupStep, ChannelConfig, TemplateChannelPreset } from "@/components/onboarding/channel-setup-step";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const DEFAULT_CHANNEL_PRESETS: TemplateChannelPreset[] = [
  { type: "whatsapp", enabled: false, defaults: {} },
  { type: "telegram", enabled: false, defaults: {} },
  { type: "discord", enabled: false, defaults: {} },
  { type: "slack", enabled: false, defaults: {} },
];

interface StepChannelsProps {
  channelConfigs: ChannelConfig[];
  onChannelChange: (configs: ChannelConfig[]) => void;
  onSkip: () => void;
}

export function StepChannels({
  channelConfigs,
  onChannelChange,
  onSkip,
}: StepChannelsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">Configure Channels</h2>
          <p className="text-muted-foreground mt-1">
            Connect messaging channels so your agent can communicate. You can always add channels later.
          </p>
        </div>
        <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
          Skip for now
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <ChannelSetupStep
        templateChannels={DEFAULT_CHANNEL_PRESETS}
        channelConfigs={channelConfigs}
        onChannelChange={onChannelChange}
      />
    </div>
  );
}
