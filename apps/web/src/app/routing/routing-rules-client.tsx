"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  api,
  type BotRoutingRule,
  type BotInstance,
  type CreateBotRoutingRulePayload,
  type UpdateBotRoutingRulePayload,
} from "@/lib/api";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  RefreshCw,
  Route,
  X,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RoutingRulesClientProps {
  initialRules: BotRoutingRule[];
  bots: BotInstance[];
}

// ---------------------------------------------------------------------------
// Rule Form (used for both create and edit)
// ---------------------------------------------------------------------------

interface RuleFormData {
  sourceBotId: string;
  targetBotId: string;
  triggerPattern: string;
  description: string;
  priority: number;
  enabled: boolean;
}

function RuleForm({
  bots,
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  bots: BotInstance[];
  initial?: Partial<RuleFormData>;
  onSubmit: (data: RuleFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState<RuleFormData>({
    sourceBotId: initial?.sourceBotId ?? "",
    targetBotId: initial?.targetBotId ?? "",
    triggerPattern: initial?.triggerPattern ?? "",
    description: initial?.description ?? "",
    priority: initial?.priority ?? 0,
    enabled: initial?.enabled ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sourceBotId || !form.targetBotId || !form.triggerPattern || !form.description) {
      setError("All fields are required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save rule");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source Bot */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Source Bot</label>
          <Select
            value={form.sourceBotId}
            onChange={(e) => setForm({ ...form, sourceBotId: e.target.value })}
          >
            <option value="">Select source bot...</option>
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Target Bot */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Target Bot</label>
          <Select
            value={form.targetBotId}
            onChange={(e) => setForm({ ...form, targetBotId: e.target.value })}
          >
            <option value="">Select target bot...</option>
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Trigger Pattern */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Trigger Pattern</label>
        <Input
          placeholder="e.g. ^/deploy .+ or .*billing.* (regex)"
          value={form.triggerPattern}
          onChange={(e) => setForm({ ...form, triggerPattern: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          JavaScript regex tested case-insensitively against inbound messages.
        </p>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Description</label>
        <Input
          placeholder="e.g. Route deploy commands to DevOps bot"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Priority */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Priority</label>
          <Input
            type="number"
            placeholder="0"
            value={form.priority}
            onChange={(e) =>
              setForm({ ...form, priority: parseInt(e.target.value, 10) || 0 })
            }
          />
          <p className="text-xs text-muted-foreground">
            Higher priority rules are evaluated first.
          </p>
        </div>

        {/* Enabled */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Enabled</label>
          <div className="flex items-center gap-2 h-10">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-muted-foreground">
              {form.enabled ? "Rule is active" : "Rule is disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Rule Card
// ---------------------------------------------------------------------------

function RuleCard({
  rule,
  bots,
  onEdit,
  onDelete,
  onToggleEnabled,
}: {
  rule: BotRoutingRule;
  bots: BotInstance[];
  onEdit: (rule: BotRoutingRule) => void;
  onDelete: (rule: BotRoutingRule) => void;
  onToggleEnabled: (rule: BotRoutingRule) => void;
}) {
  const sourceName = rule.sourceBot?.name ?? rule.sourceBotId;
  const targetName = rule.targetBot?.name ?? rule.targetBotId;

  return (
    <Card className={!rule.enabled ? "opacity-60" : ""}>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: Bot flow & description */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Source -> Target */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs">
                {sourceName}
              </Badge>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              <Badge variant="outline" className="font-mono text-xs">
                {targetName}
              </Badge>
              {rule.enabled ? (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  Enabled
                </Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                Priority: {rule.priority}
              </Badge>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground">{rule.description}</p>

            {/* Trigger pattern */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Pattern:</span>
              <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                {rule.triggerPattern}
              </code>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleEnabled(rule)}
              title={rule.enabled ? "Disable rule" : "Enable rule"}
            >
              {rule.enabled ? "Disable" : "Enable"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(rule)}
              title="Edit rule"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(rule)}
              title="Delete rule"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function RoutingRulesClient({
  initialRules,
  bots,
}: RoutingRulesClientProps) {
  const [rules, setRules] = useState<BotRoutingRule[]>(initialRules);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<BotRoutingRule | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listRoutingRules();
      setRules(result);
    } catch (err) {
      console.error("Failed to refresh routing rules:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreate = async (data: RuleFormData) => {
    const payload: CreateBotRoutingRulePayload = {
      sourceBotId: data.sourceBotId,
      targetBotId: data.targetBotId,
      triggerPattern: data.triggerPattern,
      description: data.description,
      priority: data.priority,
      enabled: data.enabled,
    };
    await api.createRoutingRule(payload);
    setShowForm(false);
    await refresh();
  };

  const handleUpdate = async (data: RuleFormData) => {
    if (!editingRule) return;
    const payload: UpdateBotRoutingRulePayload = {
      sourceBotId: data.sourceBotId,
      targetBotId: data.targetBotId,
      triggerPattern: data.triggerPattern,
      description: data.description,
      priority: data.priority,
      enabled: data.enabled,
    };
    await api.updateRoutingRule(editingRule.id, payload);
    setEditingRule(null);
    await refresh();
  };

  const handleDelete = async (rule: BotRoutingRule) => {
    if (!confirm(`Delete routing rule "${rule.description}"?`)) return;
    try {
      await api.deleteRoutingRule(rule.id);
      await refresh();
    } catch (err) {
      console.error("Failed to delete rule:", err);
    }
  };

  const handleToggleEnabled = async (rule: BotRoutingRule) => {
    try {
      await api.updateRoutingRule(rule.id, { enabled: !rule.enabled });
      await refresh();
    } catch (err) {
      console.error("Failed to toggle rule:", err);
    }
  };

  const handleEdit = (rule: BotRoutingRule) => {
    setShowForm(false);
    setEditingRule(rule);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingRule(null);
  };

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center gap-2">
        <Button onClick={() => { setEditingRule(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw
            className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Routing Rule</CardTitle>
            <CardDescription>
              Define how messages are routed between bots based on trigger
              patterns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RuleForm
              bots={bots}
              onSubmit={handleCreate}
              onCancel={handleCancelForm}
              submitLabel="Create Rule"
            />
          </CardContent>
        </Card>
      )}

      {/* Edit form */}
      {editingRule && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Routing Rule</CardTitle>
            <CardDescription>
              Update the routing rule configuration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RuleForm
              bots={bots}
              initial={{
                sourceBotId: editingRule.sourceBotId,
                targetBotId: editingRule.targetBotId,
                triggerPattern: editingRule.triggerPattern,
                description: editingRule.description,
                priority: editingRule.priority,
                enabled: editingRule.enabled,
              }}
              onSubmit={handleUpdate}
              onCancel={handleCancelForm}
              submitLabel="Save Changes"
            />
          </CardContent>
        </Card>
      )}

      {/* Rule list */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Route}
              title="No routing rules"
              description="Create your first routing rule to enable inter-bot message delegation."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              bots={bots}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleEnabled={handleToggleEnabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
