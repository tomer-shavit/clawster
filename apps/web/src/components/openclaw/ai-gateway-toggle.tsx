"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api, type AiGatewaySettings } from "@/lib/api";
import { Zap, Eye, EyeOff, Loader2 } from "lucide-react";

interface AiGatewayToggleProps {
  botId: string;
  initialEnabled: boolean;
  initialUrl?: string;
  initialApiKey?: string;
  initialProvider: string;
}

export function AiGatewayToggle({
  botId,
  initialEnabled,
  initialUrl,
  initialApiKey,
  initialProvider,
}: AiGatewayToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [gatewayUrl, setGatewayUrl] = useState(initialUrl ?? "");
  const [gatewayApiKey, setGatewayApiKey] = useState(initialApiKey ?? "");
  const [providerName, setProviderName] = useState(initialProvider || "vercel-ai-gateway");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const settings: AiGatewaySettings = {
        enabled,
        providerName,
        gatewayUrl: enabled ? gatewayUrl || undefined : undefined,
        gatewayApiKey: enabled ? gatewayApiKey || undefined : undefined,
      };

      if (enabled && !gatewayUrl) {
        setError("Gateway URL is required when enabled");
        setIsSaving(false);
        return;
      }

      await api.updateAiGatewaySettings(botId, settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update AI Gateway settings");
    } finally {
      setIsSaving(false);
    }
  }, [botId, enabled, gatewayUrl, gatewayApiKey, providerName]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">AI Gateway</CardTitle>
          </div>
          <Badge variant={enabled ? "default" : "secondary"}>
            {enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        <CardDescription>
          Route LLM API traffic through a gateway proxy for caching, rate limiting, and analytics.
          Supports Vercel AI Gateway, Cloudflare AI Gateway, or any OpenAI-compatible proxy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant={enabled ? "default" : "outline"}
            size="sm"
            onClick={() => setEnabled(!enabled)}
          >
            {enabled ? "Disable Gateway" : "Enable Gateway"}
          </Button>
        </div>

        {enabled && (
          <div className="space-y-3 pt-2 border-t">
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                Provider Name
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
              >
                <option value="vercel-ai-gateway">Vercel AI Gateway</option>
                <option value="cloudflare-ai-gateway">Cloudflare AI Gateway</option>
                <option value="custom-gateway">Custom Gateway</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                Gateway URL
              </label>
              <Input
                type="url"
                placeholder="https://gateway.vercel.ai/v1/..."
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                API Key (optional)
              </label>
              <div className="flex gap-2">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder="Gateway API key"
                  value={gatewayApiKey}
                  onChange={(e) => setGatewayApiKey(e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                  type="button"
                  aria-label={showApiKey ? "Hide API key" : "Show API key"}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {success && (
          <p className="text-sm text-green-500">AI Gateway settings saved successfully.</p>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Gateway Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
