"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  api,
  type BudgetConfig,
  type CreateBudgetPayload,
} from "@/lib/api";
import {
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Budget form
// ---------------------------------------------------------------------------

function BudgetForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: BudgetConfig;
  onSave: (data: CreateBudgetPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [monthlyLimit, setMonthlyLimit] = useState(
    initial ? (initial.monthlyLimitCents / 100).toString() : "",
  );
  const [warnPct, setWarnPct] = useState(
    (initial?.warnThresholdPct ?? 80).toString(),
  );
  const [critPct, setCritPct] = useState(
    (initial?.criticalThresholdPct ?? 95).toString(),
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name,
        monthlyLimitCents: Math.round(parseFloat(monthlyLimit) * 100),
        warnThresholdPct: parseInt(warnPct, 10),
        criticalThresholdPct: parseInt(critPct, 10),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Name</label>
          <input
            className="w-full mt-1 px-3 py-1.5 text-sm border rounded bg-background"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Fleet Monthly Budget"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Monthly Limit ($)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className="w-full mt-1 px-3 py-1.5 text-sm border rounded bg-background"
            value={monthlyLimit}
            onChange={(e) => setMonthlyLimit(e.target.value)}
            placeholder="100.00"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Warning %</label>
          <input
            type="number"
            min="1"
            max="100"
            className="w-full mt-1 px-3 py-1.5 text-sm border rounded bg-background"
            value={warnPct}
            onChange={(e) => setWarnPct(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Critical %</label>
          <input
            type="number"
            min="1"
            max="100"
            className="w-full mt-1 px-3 py-1.5 text-sm border rounded bg-background"
            value={critPct}
            onChange={(e) => setCritPct(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={saving || !name || !monthlyLimit}>
          {saving ? "Saving..." : initial ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Budget row
// ---------------------------------------------------------------------------

function BudgetRow({
  budget,
  onEdit,
  onDelete,
}: {
  budget: BudgetConfig;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const spendPct =
    budget.monthlyLimitCents > 0
      ? (budget.currentSpendCents / budget.monthlyLimitCents) * 100
      : 0;

  const barColor =
    spendPct >= budget.criticalThresholdPct
      ? "bg-red-500"
      : spendPct >= budget.warnThresholdPct
        ? "bg-yellow-500"
        : "bg-green-500";

  return (
    <div className="flex items-center gap-4 p-3 border rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{budget.name}</span>
          {!budget.isActive && (
            <Badge variant="secondary" className="text-xs">Inactive</Badge>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(spendPct, 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            ${(budget.currentSpendCents / 100).toFixed(2)} / $
            {(budget.monthlyLimitCents / 100).toFixed(2)}
          </span>
        </div>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit2 className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="w-3 h-3 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export function BudgetManagementSection() {
  const [budgets, setBudgets] = useState<BudgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchBudgets = useCallback(async () => {
    try {
      const data = await api.listBudgets();
      setBudgets(data);
    } catch (err) {
      console.error("Failed to fetch budgets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const handleCreate = async (data: CreateBudgetPayload) => {
    await api.createBudget(data);
    setShowForm(false);
    await fetchBudgets();
  };

  const handleUpdate = async (id: string, data: CreateBudgetPayload) => {
    await api.updateBudget(id, data);
    setEditingId(null);
    await fetchBudgets();
  };

  const handleDelete = async (id: string) => {
    await api.deleteBudget(id);
    await fetchBudgets();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Budget Alerts</CardTitle>
              <CardDescription>
                Set spending limits to trigger alerts when thresholds are reached
              </CardDescription>
            </div>
          </div>
          {!showForm && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-3 h-3 mr-1" />
              Add Budget
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <BudgetForm
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Loading budgets...
          </div>
        ) : budgets.length === 0 && !showForm ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No budgets configured. Add one to start tracking spend thresholds.
          </div>
        ) : (
          budgets.map((budget) =>
            editingId === budget.id ? (
              <BudgetForm
                key={budget.id}
                initial={budget}
                onSave={(data) => handleUpdate(budget.id, data)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <BudgetRow
                key={budget.id}
                budget={budget}
                onEdit={() => setEditingId(budget.id)}
                onDelete={() => handleDelete(budget.id)}
              />
            ),
          )
        )}
      </CardContent>
    </Card>
  );
}
