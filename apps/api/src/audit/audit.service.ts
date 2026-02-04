import { Injectable, Inject } from "@nestjs/common";
import {
  AuditEvent,
  AUDIT_REPOSITORY,
  IAuditRepository,
} from "@clawster/database";
import { ListAuditEventsQueryDto } from "./audit.dto";

@Injectable()
export class AuditService {
  constructor(
    @Inject(AUDIT_REPOSITORY) private readonly auditRepo: IAuditRepository,
  ) {}

  async findAll(query: ListAuditEventsQueryDto): Promise<AuditEvent[]> {
    const result = await this.auditRepo.findMany(
      {
        resourceId: query.instanceId,
        actor: query.actor,
        timestampAfter: query.from ? new Date(query.from) : undefined,
        timestampBefore: query.to ? new Date(query.to) : undefined,
      },
      { limit: 100 }
    );
    return result.data;
  }

  async logEvent(
    actor: string,
    action: string,
    resourceType: string,
    resourceId: string,
    workspaceId: string,
    diffSummary?: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.auditRepo.create({
      user: { connect: { id: actor } },
      action,
      resourceType,
      resourceId,
      workspace: { connect: { id: workspaceId } },
      diffSummary,
      metadata: JSON.stringify(metadata || {}),
    });
  }
}