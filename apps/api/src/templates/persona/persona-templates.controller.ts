import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from "@nestjs/swagger";
import { TemplateOrchestratorService } from "./template-orchestrator.service";
import {
  CreatePersonaTemplateDto,
  InjectTemplateDto,
  PersonaTemplateResponseDto,
  InjectionResultDto,
  RollbackResultDto,
  InjectionStatusDto,
} from "./persona-templates.dto";

// =============================================================================
// Persona Templates Controller
// =============================================================================

@ApiTags("persona-templates")
@Controller("persona-templates")
export class PersonaTemplatesController {
  constructor(
    private readonly orchestrator: TemplateOrchestratorService,
  ) {}

  // ---------------------------------------------------------------------------
  // Template CRUD
  // ---------------------------------------------------------------------------

  @Get()
  @ApiOperation({ summary: "List all persona templates (builtin + custom)" })
  @ApiQuery({ name: "workspaceId", required: false })
  @ApiResponse({ status: 200, type: [PersonaTemplateResponseDto] })
  async listTemplates(
    @Query("workspaceId") workspaceId?: string,
  ): Promise<PersonaTemplateResponseDto[]> {
    const templates = await this.orchestrator.listTemplates(workspaceId);
    return templates.map((t) => this.toResponseDto(t));
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single persona template by ID" })
  @ApiParam({ name: "id", description: "Template ID (e.g., builtin/marketer)" })
  @ApiResponse({ status: 200, type: PersonaTemplateResponseDto })
  @ApiResponse({ status: 404, description: "Template not found" })
  async getTemplate(
    @Param("id") id: string,
  ): Promise<PersonaTemplateResponseDto> {
    const template = await this.orchestrator.getTemplate(decodeURIComponent(id));
    return this.toResponseDto(template);
  }

  @Post()
  @ApiOperation({ summary: "Create a custom persona template" })
  @ApiResponse({ status: 201, type: PersonaTemplateResponseDto })
  async createTemplate(
    @Body() dto: CreatePersonaTemplateDto,
  ): Promise<PersonaTemplateResponseDto> {
    // For now, delegate to orchestrator (which will create in DB)
    // The orchestrator's createTemplate method needs to be implemented
    // For MVP, we return a placeholder
    return {
      id: `custom/${dto.name.toLowerCase().replace(/\s+/g, "-")}`,
      version: "1.0.0",
      name: dto.name,
      description: dto.description,
      category: dto.category,
      tags: dto.tags ?? [],
      identity: dto.identity,
      soul: dto.soul,
      skills: dto.skills ?? [],
      cronJobs: dto.cronJobs ?? [],
      configPatches: dto.configPatches,
      requiredSecrets: dto.requiredSecrets ?? [],
      isBuiltin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // Injection Operations
  // ---------------------------------------------------------------------------

  @Post(":templateId/inject/:instanceId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Inject a persona template into a bot instance" })
  @ApiParam({ name: "templateId", description: "Template ID (e.g., builtin/marketer)" })
  @ApiParam({ name: "instanceId", description: "Bot instance ID" })
  @ApiResponse({ status: 200, type: InjectionResultDto })
  @ApiResponse({ status: 404, description: "Template or instance not found" })
  @ApiResponse({ status: 400, description: "Missing required secrets" })
  async injectTemplate(
    @Param("templateId") templateId: string,
    @Param("instanceId") instanceId: string,
    @Body() dto: InjectTemplateDto,
  ): Promise<InjectionResultDto> {
    const result = await this.orchestrator.inject(
      instanceId,
      decodeURIComponent(templateId),
      { secrets: dto.secrets },
    );
    return result;
  }

  @Post("instances/:instanceId/rollback/:snapshotId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rollback an injection using a snapshot" })
  @ApiParam({ name: "instanceId", description: "Bot instance ID" })
  @ApiParam({ name: "snapshotId", description: "Injection snapshot ID" })
  @ApiResponse({ status: 200, type: RollbackResultDto })
  @ApiResponse({ status: 404, description: "Instance or snapshot not found" })
  async rollbackInjection(
    @Param("instanceId") instanceId: string,
    @Param("snapshotId") snapshotId: string,
  ): Promise<RollbackResultDto> {
    const result = await this.orchestrator.rollback(instanceId, snapshotId);
    return result;
  }

  @Get("instances/:instanceId/status")
  @ApiOperation({ summary: "Get injection status for a bot instance" })
  @ApiParam({ name: "instanceId", description: "Bot instance ID" })
  @ApiResponse({ status: 200, type: InjectionStatusDto })
  async getInjectionStatus(
    @Param("instanceId") instanceId: string,
  ): Promise<InjectionStatusDto> {
    const status = await this.orchestrator.getInjectionStatus(instanceId);
    return status;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private toResponseDto(template: {
    id: string;
    version: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    identity?: { name: string; emoji?: string; creature?: string; vibe?: string; theme?: string; avatar?: string };
    soul?: string;
    skills: string[];
    cronJobs: unknown[];
    configPatches?: Record<string, unknown>;
    requiredSecrets: unknown[];
    isBuiltin: boolean;
    workspaceId?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): PersonaTemplateResponseDto {
    return {
      id: template.id,
      version: template.version,
      name: template.name,
      description: template.description,
      category: template.category,
      tags: template.tags,
      identity: template.identity,
      soul: template.soul,
      skills: template.skills,
      cronJobs: template.cronJobs as PersonaTemplateResponseDto["cronJobs"],
      configPatches: template.configPatches,
      requiredSecrets: template.requiredSecrets as PersonaTemplateResponseDto["requiredSecrets"],
      isBuiltin: template.isBuiltin,
      workspaceId: template.workspaceId,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}
