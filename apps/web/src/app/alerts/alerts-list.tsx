"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { AlertCard } from "@/components/alerts/alert-card";
import {
  api,
  type HealthAlert,
  type HealthAlertSeverity,
  type HealthAlertStatus,
} from "@/lib/api";
import {
  RefreshCw,
  AlertTriangle,
  Check,
  Eye,
  Radio,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Severity sort order
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  ERROR: 1,
  WARNING: 2,
  INFO: 3,
};

function sortAlerts(alerts: HealthAlert[]): HealthAlert[] {
  return [...alerts].sort((a, b) => {
    const sevA = SEVERITY_ORDER[a.severity] ?? 99;
    const sevB = SEVERITY_ORDER[b.severity] ?? 99;
    if (sevA !== sevB) return sevA - sevB;
    return (
      new Date(b.lastTriggeredAt).getTime() -
      new Date(a.lastTriggeredAt).getTime()
    );
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AlertsListProps {
  initialAlerts: HealthAlert[];
  initialTotal: number;
  filters: {
    severity?: string;
    status?: string;
    instanceId?: string;
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AlertsList({
  initialAlerts,
  initialTotal,
  filters,
}: AlertsListProps) {
  const [alerts, setAlerts] = useState<HealthAlert[]>(initialAlerts ?? []);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState(
    filters.severity ?? "all",
  );
  const [statusFilter, setStatusFilter] = useState(filters.status ?? "all");

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listAlerts({
        severity:
          severityFilter !== "all"
            ? (severityFilter as HealthAlertSeverity)
            : undefined,
        status:
          statusFilter !== "all"
            ? (statusFilter as HealthAlertStatus)
            : undefined,
        instanceId: filters.instanceId,
        limit: 100,
      });
      setAlerts(result.data ?? []);
      setTotal(result.total);
      // Clear selections that no longer exist
      setSelectedIds((prev) => {
        const currentIds = new Set((result.data ?? []).map((a: HealthAlert) => a.id));
        const next = new Set<string>();
        for (const id of prev) {
          if (currentIds.has(id)) next.add(id);
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to refresh alerts:", err);
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter, filters.instanceId]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(refresh, 30_000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [autoRefresh, refresh]);

  // Toggle select
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all / none
  const handleSelectAll = useCallback(() => {
    const actionableAlerts = sortedAlerts.filter(
      (a) => a.status === "ACTIVE" || a.status === "ACKNOWLEDGED",
    );
    if (selectedIds.size === actionableAlerts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(actionableAlerts.map((a) => a.id)));
    }
  }, [alerts, selectedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bulk actions
  const handleBulkAcknowledge = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading("acknowledge");
    try {
      await api.bulkAcknowledgeAlerts(Array.from(selectedIds));
      setSelectedIds(new Set());
      await refresh();
    } catch (err) {
      console.error("Bulk acknowledge failed:", err);
    } finally {
      setBulkLoading(null);
    }
  };

  const handleBulkResolve = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading("resolve");
    try {
      await api.bulkResolveAlerts(Array.from(selectedIds));
      setSelectedIds(new Set());
      await refresh();
    } catch (err) {
      console.error("Bulk resolve failed:", err);
    } finally {
      setBulkLoading(null);
    }
  };

  const sortedAlerts = sortAlerts(alerts);
  const hasActionableAlerts = sortedAlerts.some(
    (a) => a.status === "ACTIVE" || a.status === "ACKNOWLEDGED",
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Alerts</CardTitle>
            <CardDescription>
              {total} alert{total !== 1 ? "s" : ""} found
              {selectedIds.size > 0 && (
                <span className="ml-2 text-primary font-medium">
                  ({selectedIds.size} selected)
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Auto-refresh toggle */}
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh((v) => !v)}
              title={autoRefresh ? "Disable auto-refresh (30s)" : "Enable auto-refresh (30s)"}
            >
              <Radio
                className={`w-4 h-4 mr-1 ${autoRefresh ? "animate-pulse" : ""}`}
              />
              {autoRefresh ? "Live" : "Auto"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="w-[160px]">
            <Select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
              }}
            >
              <option value="all">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="ERROR">Error</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </Select>
          </div>
          <div className="w-[160px]">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
              }}
            >
              <option value="all">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
              <option value="SUPPRESSED">Suppressed</option>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            Apply Filters
          </Button>
          {hasActionableAlerts && (
            <Button variant="ghost" size="sm" onClick={handleSelectAll}>
              {selectedIds.size > 0 ? "Deselect All" : "Select All"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Floating bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-0 z-10 mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedIds.size} alert{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={bulkLoading !== null}
                onClick={handleBulkAcknowledge}
              >
                <Eye className="w-3 h-3 mr-1" />
                {bulkLoading === "acknowledge" ? "..." : "Bulk Acknowledge"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={bulkLoading !== null}
                onClick={handleBulkResolve}
              >
                <Check className="w-3 h-3 mr-1" />
                {bulkLoading === "resolve" ? "..." : "Bulk Resolve"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {sortedAlerts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No alerts found</p>
            <p className="text-sm mt-1">
              Your OpenClaw fleet is running smoothly.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onUpdate={refresh}
                selectable={
                  alert.status === "ACTIVE" || alert.status === "ACKNOWLEDGED"
                }
                selected={selectedIds.has(alert.id)}
                onToggleSelect={handleToggleSelect}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
