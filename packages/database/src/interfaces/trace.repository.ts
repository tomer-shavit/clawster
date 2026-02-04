import type { Trace, Prisma } from "@prisma/client";
import type { PaginationOptions, PaginatedResult, TransactionClient } from "./base";

// ============================================
// FILTER TYPES
// ============================================

export interface TraceFilters {
  instanceId?: string;
  type?: string;
  status?: string;
  parentTraceId?: string | null;
  startedAfter?: Date;
  startedBefore?: Date;
  minDurationMs?: number;
  maxDurationMs?: number;
  tags?: Record<string, string>;
}

// ============================================
// RESULT TYPES
// ============================================

export interface TraceWithChildren extends Trace {
  children?: TraceWithChildren[];
}

export interface TraceTree {
  root: TraceWithChildren;
  totalNodes: number;
  maxDepth: number;
}

export interface TraceStats {
  totalTraces: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  avgDurationMs: number | null;
  minDurationMs: number | null;
  maxDurationMs: number | null;
  p50DurationMs: number | null;
  p95DurationMs: number | null;
  p99DurationMs: number | null;
}

export interface TraceStatsByType extends TraceStats {
  type: string;
}

export interface TraceStatsByInstance extends TraceStats {
  instanceId: string;
  instanceName?: string;
}

// ============================================
// INPUT TYPES
// ============================================

export type CreateTraceInput = Omit<Prisma.TraceCreateInput, "botInstance"> & {
  botInstanceId: string;
};

export type UpdateTraceInput = Partial<
  Pick<Trace, "status" | "endedAt" | "durationMs" | "output" | "error" | "metadata" | "tags">
>;

// ============================================
// REPOSITORY INTERFACE
// ============================================

export interface ITraceRepository {
  // ==========================================
  // BASIC CRUD
  // ==========================================

  /**
   * Find a trace by its internal ID
   */
  findById(id: string): Promise<Trace | null>;

  /**
   * Find a trace by its external trace ID
   */
  findByTraceId(traceId: string): Promise<Trace | null>;

  /**
   * Find multiple traces with filters
   */
  findMany(
    filters?: TraceFilters,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Trace>>;

  /**
   * Find traces by instance ID
   */
  findByInstance(
    instanceId: string,
    filters?: Omit<TraceFilters, "instanceId">,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Trace>>;

  /**
   * Create a new trace
   */
  create(data: CreateTraceInput, tx?: TransactionClient): Promise<Trace>;

  /**
   * Update an existing trace
   */
  update(
    id: string,
    data: UpdateTraceInput,
    tx?: TransactionClient
  ): Promise<Trace>;

  /**
   * Complete a trace (set status, endedAt, durationMs)
   */
  complete(
    id: string,
    status: "SUCCESS" | "ERROR",
    output?: string,
    error?: string,
    tx?: TransactionClient
  ): Promise<Trace>;

  /**
   * Delete a trace
   */
  delete(id: string, tx?: TransactionClient): Promise<void>;

  /**
   * Delete traces older than a given date
   */
  deleteOlderThan(date: Date, tx?: TransactionClient): Promise<number>;

  // ==========================================
  // TREE OPERATIONS
  // ==========================================

  /**
   * Find all child traces of a given parent
   */
  findChildren(parentTraceId: string): Promise<Trace[]>;

  /**
   * Find the complete tree starting from a root trace
   */
  findTree(rootTraceId: string, maxDepth?: number): Promise<TraceTree | null>;

  /**
   * Find all root traces (traces without parents)
   */
  findRootTraces(
    filters?: Omit<TraceFilters, "parentTraceId">,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Trace>>;

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get trace statistics for an instance
   */
  getStats(
    instanceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TraceStats>;

  /**
   * Get trace statistics grouped by type
   */
  getStatsByType(
    instanceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TraceStatsByType[]>;

  /**
   * Get trace statistics grouped by instance (for a workspace or fleet)
   */
  getStatsByInstance(
    workspaceId: string,
    fleetId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TraceStatsByInstance[]>;
}
