"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Rocket, Monitor, MessageCircle, Send, Gamepad2, Hash, Brain } from "lucide-react";
import { ChannelConfig } from "@/components/onboarding/channel-setup-step";
import { Platform } from "./step-platform";
import { ModelConfig, PROVIDERS } from "./step-model";

interface StepNameDeployProps {
  botName: string;
  onBotNameChange: (name: string) => void;
  platform: Platform;
  channels: ChannelConfig[];
  modelConfig: ModelConfig | null;
  deploying: boolean;
  onDeploy: () => void;
  error: string | null;
}

const channelIcons: Record<string, React.ReactNode> = {
  whatsapp: <MessageCircle className="w-4 h-4" />,
  telegram: <Send className="w-4 h-4" />,
  discord: <Gamepad2 className="w-4 h-4" />,
  slack: <Hash className="w-4 h-4" />,
};

const platformLabels: Record<Platform, string> = {
  docker: "Local / Docker",
  aws: "AWS",
  azure: "Azure",
  gcp: "Google Cloud",
};

const BOT_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

export function StepNameDeploy({
  botName,
  onBotNameChange,
  platform,
  channels,
  modelConfig,
  deploying,
  onDeploy,
  error,
}: StepNameDeployProps) {
  const isNameValid = botName.trim().length > 0 && BOT_NAME_REGEX.test(botName.trim());
  const enabledChannels = channels.filter((ch) => ch.config.enabled !== false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Name & Deploy</h2>
        <p className="text-muted-foreground mt-1">
          Give your agent a name and deploy it.
        </p>
      </div>

      <div className="space-y-1.5 max-w-sm">
        <label className="text-sm font-medium">Agent name</label>
        <Input
          type="text"
          placeholder="e.g., support-bot, devops-agent"
          value={botName}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "" || BOT_NAME_REGEX.test(val)) {
              onBotNameChange(val);
            }
          }}
          maxLength={63}
          autoFocus
        />
        {botName.length > 0 && !BOT_NAME_REGEX.test(botName) && (
          <p className="text-xs text-red-600">
            Must start with a letter or number, and contain only letters, numbers, hyphens, or underscores.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          A unique name for this OpenClaw agent
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Platform</span>
            <span className="font-medium flex items-center gap-1.5">
              <Monitor className="w-4 h-4" />
              {platformLabels[platform]}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Channels</span>
            {enabledChannels.length > 0 ? (
              <span className="flex items-center gap-2">
                {enabledChannels.map((ch) => (
                  <span key={ch.type} className="flex items-center gap-1 capitalize text-sm font-medium">
                    {channelIcons[ch.type.toLowerCase()]}
                    {ch.type}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">None (can add later)</span>
            )}
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">AI Model</span>
            {modelConfig ? (() => {
              const provider = PROVIDERS.find((p) => p.id === modelConfig.provider);
              const model = provider?.models.find((m) => m.id === modelConfig.model);
              return (
                <span className="font-medium flex items-center gap-1.5">
                  <Brain className="w-4 h-4" />
                  {model?.name || modelConfig.model}
                </span>
              );
            })() : (
              <span className="text-muted-foreground text-sm">Not configured</span>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button
          size="lg"
          onClick={onDeploy}
          disabled={!isNameValid || deploying}
          className="px-8"
        >
          {deploying ? (
            <>
              <span className="animate-spin mr-2">
                <Rocket className="w-4 h-4" />
              </span>
              Deploying...
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4 mr-2" />
              Deploy Agent
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
