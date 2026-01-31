"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Brain, Key, ArrowRight, Info } from "lucide-react";

export interface ModelConfig {
  provider: string;
  model: string;
  apiKey: string;
}

export const PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic",
    envVar: "ANTHROPIC_API_KEY",
    models: [
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
      { id: "claude-opus-4-5", name: "Claude Opus 4.5" },
      { id: "claude-haiku-3-5", name: "Claude Haiku 3.5" },
    ],
    placeholder: "sk-ant-...",
  },
  {
    id: "openai",
    name: "OpenAI",
    envVar: "OPENAI_API_KEY",
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "o3-mini", name: "o3-mini" },
    ],
    placeholder: "sk-...",
  },
  {
    id: "google",
    name: "Google (Gemini)",
    envVar: "GEMINI_API_KEY",
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    ],
    placeholder: "AI...",
  },
  {
    id: "groq",
    name: "Groq",
    envVar: "GROQ_API_KEY",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
    ],
    placeholder: "gsk_...",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    envVar: "OPENROUTER_API_KEY",
    models: [
      { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5 (via OpenRouter)" },
      { id: "openai/gpt-4o", name: "GPT-4o (via OpenRouter)" },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
    ],
    placeholder: "sk-or-...",
  },
];

interface StepModelProps {
  modelConfig: ModelConfig | null;
  onModelConfigChange: (config: ModelConfig | null) => void;
  onSkip: () => void;
}

export function StepModel({
  modelConfig,
  onModelConfigChange,
  onSkip,
}: StepModelProps) {
  const selectedProvider = PROVIDERS.find((p) => p.id === modelConfig?.provider) ?? null;

  function handleProviderSelect(providerId: string) {
    const provider = PROVIDERS.find((p) => p.id === providerId);
    if (!provider) return;

    onModelConfigChange({
      provider: provider.id,
      model: provider.models[0].id,
      apiKey: modelConfig?.apiKey ?? "",
    });
  }

  function handleModelChange(modelId: string) {
    if (!modelConfig) return;
    onModelConfigChange({
      ...modelConfig,
      model: modelId,
    });
  }

  function handleApiKeyChange(apiKey: string) {
    if (!modelConfig) return;
    onModelConfigChange({
      ...modelConfig,
      apiKey,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted text-muted-foreground mt-0.5">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Configure AI Model</h2>
            <p className="text-muted-foreground mt-1">
              Choose your LLM provider and enter your API key so your agent can respond to messages.
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
          Skip for now
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {PROVIDERS.map((provider) => {
          const isSelected = modelConfig?.provider === provider.id;

          return (
            <Card
              key={provider.id}
              className={cn(
                "cursor-pointer transition-colors hover:border-primary",
                isSelected && "border-primary bg-primary/5"
              )}
              onClick={() => handleProviderSelect(provider.id)}
            >
              <CardContent className="pt-6 pb-4">
                <p className="font-medium text-sm">{provider.name}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedProvider && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Model</label>
            <Select
              value={modelConfig?.model ?? ""}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              {selectedProvider.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              API Key
            </label>
            <Input
              type="password"
              placeholder={selectedProvider.placeholder}
              value={modelConfig?.apiKey ?? ""}
              onChange={(e) => handleApiKeyChange(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p>Your API key is stored securely and passed directly to the OpenClaw container.</p>
          </div>
        </div>
      )}
    </div>
  );
}
