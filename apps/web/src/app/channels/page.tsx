"use client";

import { useEffect, useState, useCallback } from "react";
import {
  api,
  Channel,
  ChannelTypeInfo,
  ChannelBotBinding,
  BotInstance,
  CreateChannelPayload,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { cn } from "@/lib/utils";
import {
  Radio,
  MessageSquare,
  Plus,
  Trash2,
  Link2,
  X,
  Loader2,
  Bot,
} from "lucide-react";

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  discord: "Discord",
  slack: "Slack",
  signal: "Signal",
  imessage: "iMessage",
  mattermost: "Mattermost",
  "google-chat": "Google Chat",
  "ms-teams": "MS Teams",
  line: "LINE",
  matrix: "Matrix",
};

function getChannelTypeLabel(type: string): string {
  return CHANNEL_TYPE_LABELS[type] || type;
}

function getStatusBadgeVariant(
  status: string
): "success" | "warning" | "destructive" | "secondary" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "PENDING":
    case "TESTING":
      return "warning";
    case "ERROR":
      return "destructive";
    default:
      return "secondary";
  }
}

function parseOpenclawType(config: string): string {
  try {
    const parsed = JSON.parse(config);
    return parsed.openclawType || "unknown";
  } catch {
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Overlay backdrop + centered card (used for both dialogs)
// ---------------------------------------------------------------------------
function DialogOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg animate-slide-down">
        {children}
      </div>
    </div>
  );
}

// ===========================================================================
// Main Page
// ===========================================================================

export default function ChannelsPage() {
  const { toast, confirm: showConfirm } = useToast();

  // Data state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelTypes, setChannelTypes] = useState<ChannelTypeInfo[]>([]);
  const [bots, setBots] = useState<BotInstance[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [bindTarget, setBindTarget] = useState<Channel | null>(null);

  // ------- data fetching -------
  const fetchChannels = useCallback(async () => {
    try {
      const data = await api.listChannels("default");
      setChannels(data);
    } catch (err) {
      toast(
        `Failed to load channels: ${err instanceof Error ? err.message : "unknown error"}`,
        "error"
      );
    }
  }, [toast]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [ch, types, botList] = await Promise.all([
          api.listChannels("default"),
          api.getChannelTypes().catch(() => [] as ChannelTypeInfo[]),
          api.listBotInstances().catch(() => [] as BotInstance[]),
        ]);
        setChannels(ch);
        setChannelTypes(types);
        setBots(botList);
      } catch (err) {
        toast(
          `Failed to load data: ${err instanceof Error ? err.message : "unknown error"}`,
          "error"
        );
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------- actions -------
  const handleDelete = async (channel: Channel) => {
    const confirmed = await showConfirm({
      message: `Delete channel "${channel.name}"?`,
      description:
        channel.botBindings.length > 0
          ? `This channel is bound to ${channel.botBindings.length} bot(s). Deleting it will remove all bindings.`
          : "This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      await api.deleteChannel(channel.id);
      toast(`Channel "${channel.name}" deleted`, "success");
      await fetchChannels();
    } catch (err) {
      toast(
        `Delete failed: ${err instanceof Error ? err.message : "unknown error"}`,
        "error"
      );
    }
  };

  const handleUnbind = async (channel: Channel, binding: ChannelBotBinding) => {
    const confirmed = await showConfirm({
      message: "Remove binding?",
      description: `Unbind bot from channel "${channel.name}"?`,
      confirmLabel: "Unbind",
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      await api.unbindChannel(channel.id, binding.id);
      toast("Binding removed", "success");
      await fetchChannels();
    } catch (err) {
      toast(
        `Unbind failed: ${err instanceof Error ? err.message : "unknown error"}`,
        "error"
      );
    }
  };

  // ------- loading state -------
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading channels...
        </div>
      </DashboardLayout>
    );
  }

  // ------- render -------
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Radio className="w-6 h-6" />
              Channels
            </h1>
            <p className="text-muted-foreground">
              Manage messaging channels and their bot bindings
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Channel
          </Button>
        </div>

        {/* Channel list or empty state */}
        {channels.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                icon={MessageSquare}
                title="No channels yet"
                description="Add a messaging channel to start connecting bots to WhatsApp, Telegram, Discord, and more."
              />
              <div className="flex justify-center mt-2">
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Channel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {channels.map((channel) => {
              const openclawType = parseOpenclawType(channel.config);
              return (
                <Card key={channel.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: info */}
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {channel.name}
                            </span>
                            <Badge variant="outline">
                              {getChannelTypeLabel(openclawType)}
                            </Badge>
                            <Badge
                              variant={getStatusBadgeVariant(channel.status)}
                            >
                              {channel.status}
                            </Badge>
                          </div>
                          {/* Bindings */}
                          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <Bot className="w-3.5 h-3.5" />
                            {channel.botBindings.length === 0 ? (
                              <span>No bots bound</span>
                            ) : (
                              <span>
                                {channel.botBindings.length} bot
                                {channel.botBindings.length !== 1 ? "s" : ""}{" "}
                                bound
                              </span>
                            )}
                            {channel.botBindings.map((b) => {
                              const bot = bots.find((bt) => bt.id === b.botId);
                              return (
                                <Badge
                                  key={b.id}
                                  variant="secondary"
                                  className="cursor-pointer hover:bg-destructive/20"
                                  onClick={() => handleUnbind(channel, b)}
                                  title="Click to unbind"
                                >
                                  {bot?.name || b.botId.slice(0, 8)}
                                  {" - "}
                                  {b.purpose}
                                  <X className="w-3 h-3 ml-1" />
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBindTarget(channel)}
                        >
                          <Link2 className="w-4 h-4 mr-1" />
                          Bind to Bot
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(channel)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================== Add Channel Dialog ===================== */}
      {showAddDialog && (
        <AddChannelDialog
          channelTypes={channelTypes}
          onClose={() => setShowAddDialog(false)}
          onCreated={async () => {
            setShowAddDialog(false);
            await fetchChannels();
          }}
          toast={toast}
        />
      )}

      {/* ===================== Bind to Bot Dialog ===================== */}
      {bindTarget && (
        <BindToBotDialog
          channel={bindTarget}
          bots={bots}
          onClose={() => setBindTarget(null)}
          onBound={async () => {
            setBindTarget(null);
            await fetchChannels();
          }}
          toast={toast}
        />
      )}
    </DashboardLayout>
  );
}

// ===========================================================================
// Add Channel Dialog
// ===========================================================================

function AddChannelDialog({
  channelTypes,
  onClose,
  onCreated,
  toast,
}: {
  channelTypes: ChannelTypeInfo[];
  onClose: () => void;
  onCreated: () => void;
  toast: (msg: string, type?: "success" | "error" | "warning" | "info") => void;
}) {
  const [step, setStep] = useState<"select-type" | "configure">("select-type");
  const [selectedType, setSelectedType] = useState<ChannelTypeInfo | null>(null);
  const [name, setName] = useState("");
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // All known types as fallback if API returns nothing
  const fallbackTypes = Object.entries(CHANNEL_TYPE_LABELS).map(
    ([type, label]) => ({
      type,
      label,
      requiresNodeRuntime: false,
      authMethod: "token" as const,
      requiredSecrets: [] as string[],
      optionalSecrets: [] as string[],
      defaultConfig: {},
    })
  );

  const types = channelTypes.length > 0 ? channelTypes : fallbackTypes;

  const handleSelectType = (ct: ChannelTypeInfo) => {
    setSelectedType(ct);
    setName("");
    setSecrets({});
    setStep("configure");
  };

  const handleCreate = async () => {
    if (!selectedType || !name.trim()) return;

    setSubmitting(true);
    try {
      const payload: CreateChannelPayload = {
        name: name.trim(),
        workspaceId: "default",
        openclawType: selectedType.type,
      };

      // Only attach secrets if any values are non-empty
      const filledSecrets = Object.fromEntries(
        Object.entries(secrets).filter(([, v]) => v.trim() !== "")
      );
      if (Object.keys(filledSecrets).length > 0) {
        payload.secrets = filledSecrets;
      }

      await api.createChannel(payload);
      toast(`Channel "${name}" created`, "success");
      onCreated();
    } catch (err) {
      toast(
        `Failed to create channel: ${err instanceof Error ? err.message : "unknown error"}`,
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogOverlay onClose={onClose}>
      <Card className="shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">
            {step === "select-type" ? "Select Channel Type" : "Configure Channel"}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {step === "select-type" ? (
            <div className="grid grid-cols-3 gap-2">
              {types.map((ct) => (
                <button
                  key={ct.type}
                  onClick={() => handleSelectType(ct)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-lg border p-3 text-sm font-medium transition-colors",
                    "hover:border-primary hover:bg-accent"
                  )}
                >
                  <MessageSquare className="w-5 h-5 text-muted-foreground" />
                  <span>{ct.label || getChannelTypeLabel(ct.type)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">
                  {selectedType
                    ? selectedType.label || getChannelTypeLabel(selectedType.type)
                    : ""}
                </Badge>
                <button
                  className="text-xs underline hover:no-underline"
                  onClick={() => setStep("select-type")}
                >
                  Change
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Channel Name
                </label>
                <Input
                  placeholder={`My ${selectedType ? getChannelTypeLabel(selectedType.type) : ""} channel`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Required secrets */}
              {selectedType &&
                selectedType.requiredSecrets.length > 0 && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium">
                      Required Secrets
                    </label>
                    {selectedType.requiredSecrets.map((key) => (
                      <div key={key}>
                        <label className="block text-xs text-muted-foreground mb-1">
                          {key}
                        </label>
                        <Input
                          type="password"
                          placeholder={key}
                          value={secrets[key] || ""}
                          onChange={(e) =>
                            setSecrets((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

              {/* Optional secrets */}
              {selectedType &&
                selectedType.optionalSecrets.length > 0 && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium">
                      Optional Secrets
                    </label>
                    {selectedType.optionalSecrets.map((key) => (
                      <div key={key}>
                        <label className="block text-xs text-muted-foreground mb-1">
                          {key}
                        </label>
                        <Input
                          type="password"
                          placeholder={`${key} (optional)`}
                          value={secrets[key] || ""}
                          onChange={(e) =>
                            setSecrets((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!name.trim() || submitting}
                >
                  {submitting && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Create Channel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </DialogOverlay>
  );
}

// ===========================================================================
// Bind to Bot Dialog
// ===========================================================================

function BindToBotDialog({
  channel,
  bots,
  onClose,
  onBound,
  toast,
}: {
  channel: Channel;
  bots: BotInstance[];
  onClose: () => void;
  onBound: () => void;
  toast: (msg: string, type?: "success" | "error" | "warning" | "info") => void;
}) {
  const [selectedBotId, setSelectedBotId] = useState("");
  const [purpose, setPurpose] = useState("default");
  const [submitting, setSubmitting] = useState(false);

  const handleBind = async () => {
    if (!selectedBotId) return;

    setSubmitting(true);
    try {
      await api.bindChannelToBot(channel.id, selectedBotId, purpose);
      const botName =
        bots.find((b) => b.id === selectedBotId)?.name || selectedBotId;
      toast(`Bound "${botName}" to "${channel.name}"`, "success");
      onBound();
    } catch (err) {
      toast(
        `Bind failed: ${err instanceof Error ? err.message : "unknown error"}`,
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogOverlay onClose={onClose}>
      <Card className="shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Bind to Bot</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bind channel <span className="font-medium">{channel.name}</span> to
            a bot instance.
          </p>

          {/* Bot selector */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Bot Instance
            </label>
            {bots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No bot instances available. Deploy a bot first.
              </p>
            ) : (
              <Select
                value={selectedBotId}
                onChange={(e) => setSelectedBotId(e.target.value)}
              >
                <option value="">Select a bot...</option>
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name} ({bot.status})
                  </option>
                ))}
              </Select>
            )}
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium mb-1">Purpose</label>
            <Select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            >
              <option value="default">Default</option>
              <option value="primary">Primary</option>
              <option value="fallback">Fallback</option>
              <option value="testing">Testing</option>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleBind}
              disabled={!selectedBotId || submitting}
            >
              {submitting && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Bind
            </Button>
          </div>
        </CardContent>
      </Card>
    </DialogOverlay>
  );
}
