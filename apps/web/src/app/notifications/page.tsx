"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import {
  api,
  type NotificationChannel,
  type NotificationChannelType,
  type AlertNotificationRule,
} from "@/lib/api";
import {
  Bell,
  Plus,
  Trash2,
  TestTube2,
  Loader2,
  CheckCircle,
  XCircle,
  Mail,
  Webhook,
  Hash,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHANNEL_TYPE_LABELS: Record<NotificationChannelType, string> = {
  SLACK_WEBHOOK: "Slack Webhook",
  WEBHOOK: "Webhook",
  EMAIL: "Email",
};

const CHANNEL_TYPE_ICONS: Record<NotificationChannelType, React.ReactNode> = {
  SLACK_WEBHOOK: <Hash className="w-4 h-4" />,
  WEBHOOK: <Webhook className="w-4 h-4" />,
  EMAIL: <Mail className="w-4 h-4" />,
};

const SEVERITY_OPTIONS = ["CRITICAL", "ERROR", "WARNING", "INFO"];

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleString();
}

// ---------------------------------------------------------------------------
// Add / Edit Channel Form
// ---------------------------------------------------------------------------

interface ChannelFormProps {
  onSave: () => void;
  onCancel: () => void;
}

function AddChannelForm({ onSave, onCancel }: ChannelFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<NotificationChannelType>("SLACK_WEBHOOK");
  const [url, setUrl] = useState("");
  const [emailAddresses, setEmailAddresses] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      let config: string;
      if (type === "SLACK_WEBHOOK") {
        config = JSON.stringify({ url });
      } else if (type === "WEBHOOK") {
        config = JSON.stringify({ url });
      } else {
        config = JSON.stringify({
          addresses: emailAddresses.split(",").map((a) => a.trim()).filter(Boolean),
        });
      }

      await api.createNotificationChannel({ name, type, config, enabled });
      onSave();
    } catch (err: any) {
      setError(err.message || "Failed to create channel");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add Notification Channel</CardTitle>
        <CardDescription>
          Configure a new channel to receive alert notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production Alerts"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as NotificationChannelType)}
              >
                <option value="SLACK_WEBHOOK">Slack Webhook</option>
                <option value="WEBHOOK">Webhook</option>
                <option value="EMAIL">Email</option>
              </Select>
            </div>
          </div>

          {(type === "SLACK_WEBHOOK" || type === "WEBHOOK") && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {type === "SLACK_WEBHOOK" ? "Slack Webhook URL" : "Webhook URL"}
              </label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  type === "SLACK_WEBHOOK"
                    ? "https://hooks.slack.com/services/..."
                    : "https://your-endpoint.com/webhook"
                }
                type="url"
                required
              />
            </div>
          )}

          {type === "EMAIL" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Addresses</label>
              <Input
                value={emailAddresses}
                onChange={(e) => setEmailAddresses(e.target.value)}
                placeholder="user@example.com, admin@example.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of email addresses
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="channel-enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-input"
            />
            <label htmlFor="channel-enabled" className="text-sm font-medium">
              Enabled
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Channel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Add Rule Form
// ---------------------------------------------------------------------------

interface AddRuleFormProps {
  channelId: string;
  onSave: () => void;
  onCancel: () => void;
}

function AddRuleForm({ channelId, onSave, onCancel }: AddRuleFormProps) {
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [alertRulesText, setAlertRulesText] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSeverity = (sev: string) => {
    setSelectedSeverities((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const alertRules = alertRulesText
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);

      await api.createNotificationRule(channelId, {
        channelId,
        severities: selectedSeverities.length > 0 ? JSON.stringify(selectedSeverities) : undefined,
        alertRules: alertRules.length > 0 ? JSON.stringify(alertRules) : undefined,
        enabled,
      });
      onSave();
    } catch (err: any) {
      setError(err.message || "Failed to create rule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-muted/50">
      <p className="text-sm font-medium mb-3">New Notification Rule</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Alert Severities (leave empty for all)
          </label>
          <div className="flex flex-wrap gap-2">
            {SEVERITY_OPTIONS.map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => toggleSeverity(sev)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  selectedSeverities.includes(sev)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-input hover:bg-accent"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Alert Rule Names (comma-separated, leave empty for all)
          </label>
          <Input
            value={alertRulesText}
            onChange={(e) => setAlertRulesText(e.target.value)}
            placeholder="e.g. token_spike, budget_critical"
            className="text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="rule-enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-input"
          />
          <label htmlFor="rule-enabled" className="text-xs font-medium">
            Enabled
          </label>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Add Rule
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Channel Card
// ---------------------------------------------------------------------------

interface ChannelCardProps {
  channel: NotificationChannel;
  onRefresh: () => void;
}

function ChannelCard({ channel, onRefresh }: ChannelCardProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testNotificationChannel(channel.id);
      setTestResult(result.lastError ? "error" : "success");
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 3000);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete notification channel "${channel.name}"?`)) return;
    setDeleting(true);
    try {
      await api.deleteNotificationChannel(channel.id);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete channel:", err);
      setDeleting(false);
    }
  };

  const handleToggleEnabled = async () => {
    setTogglingEnabled(true);
    try {
      await api.updateNotificationChannel(channel.id, {
        enabled: !channel.enabled,
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to toggle channel:", err);
    } finally {
      setTogglingEnabled(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await api.deleteNotificationRule(ruleId);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete rule:", err);
    }
  };

  const handleToggleRule = async (rule: AlertNotificationRule) => {
    try {
      await api.updateNotificationRule(rule.id, { enabled: !rule.enabled });
      onRefresh();
    } catch (err) {
      console.error("Failed to toggle rule:", err);
    }
  };

  let configSummary = "";
  try {
    const parsed = JSON.parse(channel.config);
    if (channel.type === "EMAIL") {
      const addrs: string[] = parsed.addresses || [];
      configSummary = addrs.join(", ");
    } else {
      configSummary = parsed.url || "";
    }
  } catch {
    configSummary = "(invalid config)";
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              {CHANNEL_TYPE_ICONS[channel.type as NotificationChannelType] || (
                <Bell className="w-4 h-4" />
              )}
            </div>
            <div>
              <CardTitle className="text-base">{channel.name}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {CHANNEL_TYPE_LABELS[channel.type as NotificationChannelType] || channel.type}
                {" -- "}
                <span className="text-muted-foreground truncate max-w-[300px] inline-block align-bottom">
                  {configSummary}
                </span>
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={channel.enabled ? "success" : "secondary"}>
              {channel.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Deliveries</p>
            <p className="font-medium">{channel.deliveryCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Failures</p>
            <p className="font-medium text-red-600">{channel.failureCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Last Delivery</p>
            <p className="font-medium text-xs">
              {formatDate(channel.lastDeliveryAt)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Last Tested</p>
            <p className="font-medium text-xs">
              {formatDate(channel.lastTestedAt)}
            </p>
          </div>
        </div>

        {channel.lastError && (
          <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded p-2">
            Last error: {channel.lastError}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : testResult === "success" ? (
              <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
            ) : testResult === "error" ? (
              <XCircle className="w-4 h-4 mr-1 text-red-600" />
            ) : (
              <TestTube2 className="w-4 h-4 mr-1" />
            )}
            Test
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleEnabled}
            disabled={togglingEnabled}
          >
            {togglingEnabled && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {channel.enabled ? "Disable" : "Enable"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4 mr-1" />
            ) : (
              <ChevronDown className="w-4 h-4 mr-1" />
            )}
            Rules ({channel.notificationRules?.length || 0})
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-1" />
            )}
            Delete
          </Button>
        </div>

        {/* Rules section (expandable) */}
        {expanded && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Notification Rules</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRuleForm(true)}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Rule
              </Button>
            </div>

            {channel.notificationRules?.length === 0 && !showRuleForm && (
              <p className="text-xs text-muted-foreground py-2">
                No rules configured. This channel will not receive any notifications. Add a rule to start receiving alerts.
              </p>
            )}

            {channel.notificationRules?.map((rule) => {
              const severities = parseJsonArray(rule.severities);
              const alertRules = parseJsonArray(rule.alertRules);

              return (
                <div
                  key={rule.id}
                  className="flex items-start justify-between border rounded-lg p-3 text-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={rule.enabled ? "default" : "secondary"}
                      >
                        {rule.enabled ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Severities:{" "}
                      {severities.length > 0
                        ? severities.join(", ")
                        : "All"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Alert rules:{" "}
                      {alertRules.length > 0
                        ? alertRules.join(", ")
                        : "All"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleRule(rule)}
                      className="text-xs h-7"
                    >
                      {rule.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-red-600 hover:text-red-700 h-7"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {showRuleForm && (
              <AddRuleForm
                channelId={channel.id}
                onSave={() => {
                  setShowRuleForm(false);
                  onRefresh();
                }}
                onCancel={() => setShowRuleForm(false)}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NotificationsPage() {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    try {
      const data = await api.listNotificationChannels();
      setChannels(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load notification channels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const handleRefresh = () => {
    fetchChannels();
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Notification Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure channels and rules for alert notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Channel
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Channels</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{channels.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {channels.filter((c) => c.enabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {channels.reduce((sum, c) => sum + c.deliveryCount, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Failures</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {channels.reduce((sum, c) => sum + c.failureCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg">
          {error}
        </div>
      )}

      {/* Add channel form */}
      {showAddForm && (
        <div className="mb-6">
          <AddChannelForm
            onSave={() => {
              setShowAddForm(false);
              handleRefresh();
            }}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* Channel list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-8">
                <div className="animate-pulse flex items-center gap-4">
                  <div className="w-10 h-10 bg-muted rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : channels.length === 0 && !showAddForm ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Bell}
              title="No notification channels"
              description="Configure notification channels to receive alerts via Slack, webhooks, or email when issues are detected in your OpenClaw fleet."
            />
            <div className="flex justify-center mt-4">
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Channel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
