'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge, HealthIndicator } from '@/components/ui/status-badge';
import { EnvironmentBadge } from '@/components/ui/environment-badge';
import { TimeDisplay } from '@/components/ui/time-display';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { api, type BotInstance, type Fleet } from '@/lib/api';
import { getBotDescription, formatUptime, formatDeploymentType } from '@/lib/bot-utils';

interface BotsListClientProps {
  initialBots: BotInstance[];
  fleets: Fleet[];
}

type SortField = 'name' | 'status' | 'health' | 'uptime' | 'errors';
type SortDirection = 'asc' | 'desc';

function getUptimeSeconds(bot: BotInstance): number {
  if (!bot.runningSince) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(bot.runningSince).getTime()) / 1000));
}

function SortIcon({ field, activeField, direction }: { field: SortField; activeField: SortField; direction: SortDirection }) {
  if (field !== activeField) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
  return direction === 'asc'
    ? <ArrowUp className="w-3 h-3 ml-1" />
    : <ArrowDown className="w-3 h-3 ml-1" />;
}

export function BotsListClient({ initialBots, fleets }: BotsListClientProps) {
  const router = useRouter();
  const [bots, setBots] = useState(initialBots);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');
  const [fleetFilter, setFleetFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [loading, setLoading] = useState(false);
  const [refreshError, setRefreshError] = useState(false);

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDirection('asc');
      return field;
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setRefreshError(false);
    try {
      const fresh = await api.listBotInstances();
      setBots(fresh);
    } catch {
      setRefreshError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredAndSorted = useMemo(() => {
    let result = bots;

    // Search across name, description, and fleet name
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b) => {
        const desc = getBotDescription(b) || '';
        const fleet = b.fleet?.name || '';
        const haystack = `${b.name} ${desc} ${fleet}`.toLowerCase();
        return haystack.includes(q);
      });
    }

    // Filters
    if (statusFilter !== 'all') {
      result = result.filter((b) => b.status === statusFilter);
    }
    if (healthFilter !== 'all') {
      result = result.filter((b) => b.health === healthFilter);
    }
    if (fleetFilter !== 'all') {
      result = result.filter((b) => b.fleetId === fleetFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'health':
          cmp = a.health.localeCompare(b.health);
          break;
        case 'uptime':
          cmp = getUptimeSeconds(a) - getUptimeSeconds(b);
          break;
        case 'errors':
          cmp = a.errorCount - b.errorCount;
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [bots, searchQuery, statusFilter, healthFilter, fleetFilter, sortField, sortDirection]);

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Filter bar */}
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search bots..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-[150px]"
          >
            <option value="all">All Statuses</option>
            <option value="RUNNING">Running</option>
            <option value="STOPPED">Stopped</option>
            <option value="ERROR">Error</option>
            <option value="DEGRADED">Degraded</option>
            <option value="PAUSED">Paused</option>
            <option value="CREATING">Creating</option>
            <option value="PENDING">Pending</option>
            <option value="RECONCILING">Reconciling</option>
            <option value="DELETING">Deleting</option>
          </Select>
          <Select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            className="w-[150px]"
          >
            <option value="all">All Health</option>
            <option value="HEALTHY">Healthy</option>
            <option value="UNHEALTHY">Unhealthy</option>
            <option value="DEGRADED">Degraded</option>
            <option value="UNKNOWN">Unknown</option>
          </Select>
          {fleets.length > 0 && (
            <Select
              value={fleetFilter}
              onChange={(e) => setFleetFilter(e.target.value)}
              className="w-[180px]"
            >
              <option value="all">All Fleets</option>
              {fleets.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.environment})
                </option>
              ))}
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="ml-auto"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {refreshError && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            Failed to refresh. Showing cached data.
          </div>
        )}

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button className="flex items-center font-medium" onClick={() => handleSort('name')}>
                    Name
                    <SortIcon field="name" activeField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center font-medium" onClick={() => handleSort('status')}>
                    Status
                    <SortIcon field="status" activeField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center font-medium" onClick={() => handleSort('health')}>
                    Health
                    <SortIcon field="health" activeField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>Fleet</TableHead>
                <TableHead>Deploy</TableHead>
                <TableHead>
                  <button className="flex items-center font-medium" onClick={() => handleSort('uptime')}>
                    Uptime
                    <SortIcon field="uptime" activeField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center font-medium" onClick={() => handleSort('errors')}>
                    Errors
                    <SortIcon field="errors" activeField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>Last Check</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No bots match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSorted.map((bot) => {
                  const description = getBotDescription(bot);
                  const deployType = bot.deploymentTarget?.type || bot.deploymentType;

                  return (
                    <TableRow
                      key={bot.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/bots/${bot.id}`)}
                    >
                      <TableCell>
                        <div>
                          <span className="font-medium">{bot.name}</span>
                          {description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                              {description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={bot.status} />
                      </TableCell>
                      <TableCell>
                        <HealthIndicator health={bot.health} />
                      </TableCell>
                      <TableCell>
                        {bot.fleet ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{bot.fleet.name}</span>
                            <EnvironmentBadge environment={bot.fleet.environment} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deployType ? (
                          <Badge variant="secondary" className="text-xs">
                            {formatDeploymentType(deployType)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatUptime(bot.runningSince)}
                      </TableCell>
                      <TableCell>
                        {bot.errorCount > 0 ? (
                          <span
                            className="text-sm font-medium text-red-600"
                            title={bot.lastError || undefined}
                          >
                            {bot.errorCount}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {bot.lastHealthCheckAt ? (
                          <TimeDisplay date={bot.lastHealthCheckAt} />
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Result count */}
        <div className="mt-3 text-xs text-muted-foreground">
          Showing {filteredAndSorted.length} of {bots.length} bot{bots.length !== 1 ? 's' : ''}
        </div>
      </CardContent>
    </Card>
  );
}
