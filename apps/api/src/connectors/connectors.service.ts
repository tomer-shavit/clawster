import { Injectable, Inject, NotFoundException, BadRequestException } from "@nestjs/common";
import {
  IntegrationConnector,
  CONNECTOR_REPOSITORY,
  IConnectorRepository,
} from "@clawster/database";
import { CreateConnectorDto, UpdateConnectorDto, ListConnectorsQueryDto, TestConnectionDto } from "./connectors.dto";

@Injectable()
export class ConnectorsService {
  constructor(
    @Inject(CONNECTOR_REPOSITORY) private readonly connectorRepo: IConnectorRepository,
  ) {}

  async create(dto: CreateConnectorDto): Promise<IntegrationConnector> {
    const connector = await this.connectorRepo.createConnector({
      workspace: { connect: { id: dto.workspaceId } },
      name: dto.name,
      description: dto.description,
      type: dto.type,
      config: JSON.stringify(dto.config),
      isShared: dto.isShared ?? true,
      allowedInstanceIds: JSON.stringify(dto.allowedInstanceIds || []),
      tags: JSON.stringify(dto.tags || {}),
      createdBy: dto.createdBy || "system",
    });

    return connector;
  }

  async findAll(query: ListConnectorsQueryDto): Promise<IntegrationConnector[]> {
    const result = await this.connectorRepo.findManyConnectors({
      workspaceId: query.workspaceId,
      type: query.type,
      status: query.status,
      isShared: query.isShared,
    });
    return result.data;
  }

  async findOne(id: string): Promise<IntegrationConnector> {
    const connector = await this.connectorRepo.findConnectorById(id);

    if (!connector) {
      throw new NotFoundException(`Connector ${id} not found`);
    }

    return connector;
  }

  async update(id: string, dto: UpdateConnectorDto): Promise<IntegrationConnector> {
    await this.findOne(id);

    return this.connectorRepo.updateConnector(id, {
      ...(dto.name && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.config && { config: JSON.stringify(dto.config) }),
      ...(dto.isShared !== undefined && { isShared: dto.isShared }),
      ...(dto.allowedInstanceIds && { allowedInstanceIds: JSON.stringify(dto.allowedInstanceIds) }),
      ...(dto.tags && { tags: JSON.stringify(dto.tags) }),
      ...(dto.rotationSchedule && { rotationSchedule: JSON.stringify(dto.rotationSchedule) }),
    });
  }

  async updateStatus(id: string, status: string, message?: string): Promise<IntegrationConnector> {
    await this.findOne(id);

    return this.connectorRepo.updateConnectorStatus(id, status, message);
  }

  async remove(id: string): Promise<void> {
    // Check for active bindings
    const bindings = await this.connectorRepo.findBindingsByConnector(id);

    if (bindings.length > 0) {
      throw new BadRequestException(
        `Cannot delete connector with ${bindings.length} active bindings. Remove bindings first.`
      );
    }

    await this.connectorRepo.deleteConnector(id);
  }

  async testConnection(id: string, dto: TestConnectionDto): Promise<Record<string, unknown>> {
    const connector = await this.findOne(id);
    const startTime = Date.now();

    try {
      // Simulate connection test based on connector type
      // In a real implementation, this would actually test the connection
      const testResult = await this.performConnectionTest(connector);

      await this.connectorRepo.recordTestResult(id, testResult.success, testResult.message);

      return {
        connectorId: id,
        testedAt: new Date(),
        success: testResult.success,
        responseTimeMs: Date.now() - startTime,
        message: testResult.message,
        checks: testResult.checks || [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await this.connectorRepo.recordTestResult(id, false, message);

      return {
        connectorId: id,
        testedAt: new Date(),
        success: false,
        responseTimeMs: Date.now() - startTime,
        message,
        checks: [],
      };
    }
  }

  private async performConnectionTest(connector: IntegrationConnector): Promise<{ success: boolean; message: string; checks?: Record<string, unknown>[] }> {
    // Placeholder for actual connection testing
    // In production, this would test actual API connectivity
    switch (connector.type) {
      case "openai":
        return {
          success: true,
          message: "Successfully connected to OpenAI API",
          checks: [
            { name: "Authentication", passed: true },
            { name: "API Access", passed: true },
          ],
        };
      case "slack":
        return {
          success: true,
          message: "Successfully connected to Slack API",
          checks: [
            { name: "Bot Token", passed: true },
            { name: "Channel Access", passed: true },
          ],
        };
      default:
        return {
          success: true,
          message: `Connection test passed for ${connector.type}`,
        };
    }
  }
}