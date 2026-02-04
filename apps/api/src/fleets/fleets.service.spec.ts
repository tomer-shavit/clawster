/**
 * Unit Tests - Fleet Service
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FleetService } from './fleets.service';
import {
  FLEET_REPOSITORY,
  IFleetRepository,
  BOT_INSTANCE_REPOSITORY,
  IBotInstanceRepository,
  WORKSPACE_REPOSITORY,
  IWorkspaceRepository,
} from '@clawster/database';

describe('FleetService', () => {
  let service: FleetService;

  // Mock repositories
  const mockFleetRepo: jest.Mocked<IFleetRepository> = {
    findById: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    getHealthSummary: jest.fn(),
    findByIdWithInstances: jest.fn(),
    findManyWithInstances: jest.fn(),
  };

  const mockBotInstanceRepo: jest.Mocked<Partial<IBotInstanceRepository>> = {
    findByFleet: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };

  const mockWorkspaceRepo: jest.Mocked<Partial<IWorkspaceRepository>> = {
    findFirstWorkspace: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FleetService,
        { provide: FLEET_REPOSITORY, useValue: mockFleetRepo },
        { provide: BOT_INSTANCE_REPOSITORY, useValue: mockBotInstanceRepo },
        { provide: WORKSPACE_REPOSITORY, useValue: mockWorkspaceRepo },
      ],
    }).compile();

    service = module.get<FleetService>(FleetService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      workspaceId: 'workspace-123',
      name: 'test-fleet',
      environment: 'dev' as const,
      description: 'Test fleet',
      tags: { team: 'test' },
    };

    it('should create a fleet successfully', async () => {
      mockFleetRepo.findFirst.mockResolvedValue(null);
      mockFleetRepo.create.mockResolvedValue({
        id: 'fleet-123',
        workspaceId: createDto.workspaceId,
        name: createDto.name,
        environment: createDto.environment,
        description: createDto.description,
        tags: JSON.stringify(createDto.tags),
        status: 'ACTIVE',
        defaultProfileId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(createDto);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('test-fleet');
      expect(mockFleetRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        workspace: { connect: { id: 'workspace-123' } },
        name: 'test-fleet',
        status: 'ACTIVE',
      }));
    });

    it('should throw BadRequestException for duplicate name', async () => {
      mockFleetRepo.findFirst.mockResolvedValue({
        id: 'existing-fleet',
        name: 'test-fleet',
        workspaceId: 'workspace-123',
        environment: 'dev',
        description: null,
        tags: '{}',
        status: 'ACTIVE',
        defaultProfileId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return list of fleets', async () => {
      mockFleetRepo.findManyWithInstances.mockResolvedValue([
        { id: 'fleet-1', name: 'Fleet 1' },
        { id: 'fleet-2', name: 'Fleet 2' },
      ] as any);

      const result = await service.findAll({ workspaceId: 'workspace-123' });

      expect(result).toHaveLength(2);
      expect(mockFleetRepo.findManyWithInstances).toHaveBeenCalledWith({
        workspaceId: 'workspace-123',
        environment: undefined,
        status: undefined,
      });
    });

    it('should filter by environment', async () => {
      mockFleetRepo.findManyWithInstances.mockResolvedValue([]);

      await service.findAll({ workspaceId: 'workspace-123', environment: 'prod' });

      expect(mockFleetRepo.findManyWithInstances).toHaveBeenCalledWith({
        workspaceId: 'workspace-123',
        environment: 'prod',
        status: undefined,
      });
    });

    it('should filter by status', async () => {
      mockFleetRepo.findManyWithInstances.mockResolvedValue([]);

      await service.findAll({ workspaceId: 'workspace-123', status: 'ACTIVE' });

      expect(mockFleetRepo.findManyWithInstances).toHaveBeenCalledWith({
        workspaceId: 'workspace-123',
        environment: undefined,
        status: 'ACTIVE',
      });
    });
  });

  describe('findOne', () => {
    it('should return fleet by id', async () => {
      mockFleetRepo.findByIdWithInstances.mockResolvedValue({
        id: 'fleet-123',
        name: 'Test Fleet',
        instances: [],
        profiles: [],
      } as any);

      const result = await service.findOne('fleet-123');

      expect(result.id).toBe('fleet-123');
      expect(result.instances).toEqual([]);
    });

    it('should throw NotFoundException for non-existent fleet', async () => {
      mockFleetRepo.findByIdWithInstances.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = {
      description: 'Updated description',
    };

    it('should update fleet successfully', async () => {
      mockFleetRepo.findByIdWithInstances.mockResolvedValue({
        id: 'fleet-123',
        instances: [],
        profiles: [],
      } as any);
      mockFleetRepo.update.mockResolvedValue({
        id: 'fleet-123',
        description: 'Updated description',
      } as any);

      const result = await service.update('fleet-123', updateDto);

      expect(result.description).toBe('Updated description');
    });

    it('should throw NotFoundException for non-existent fleet', async () => {
      mockFleetRepo.findByIdWithInstances.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update status successfully', async () => {
      mockFleetRepo.findByIdWithInstances.mockResolvedValue({
        id: 'fleet-123',
        status: 'ACTIVE',
        instances: [],
        profiles: [],
      } as any);
      mockFleetRepo.update.mockResolvedValue({
        id: 'fleet-123',
        status: 'PAUSED',
      } as any);

      const result = await service.updateStatus('fleet-123', 'PAUSED');

      expect(result.status).toBe('PAUSED');
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      mockFleetRepo.findByIdWithInstances.mockResolvedValue({
        id: 'fleet-123',
        status: 'DRAINING',
        instances: [],
        profiles: [],
      } as any);

      await expect(service.updateStatus('fleet-123', 'PAUSED')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent fleet', async () => {
      mockFleetRepo.findByIdWithInstances.mockResolvedValue(null);

      await expect(service.updateStatus('non-existent', 'PAUSED')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHealth', () => {
    it('should return fleet health breakdown', async () => {
      mockFleetRepo.findByIdWithInstances.mockResolvedValue({
        id: 'fleet-123',
        status: 'ACTIVE',
        instances: [],
        profiles: [],
      } as any);
      mockFleetRepo.getHealthSummary.mockResolvedValue({
        fleetId: 'fleet-123',
        fleetName: 'Test Fleet',
        totalInstances: 4,
        healthyCounts: {
          healthy: 2,
          unhealthy: 1,
          degraded: 0,
          unknown: 1,
        },
        statusCounts: {
          running: 3,
          stopped: 0,
          error: 1,
          creating: 0,
          pending: 0,
          other: 0,
        },
      });

      const result = await service.getHealth('fleet-123');

      expect(result.fleetId).toBe('fleet-123');
      expect(result.totalInstances).toBe(4);
      expect(result.healthyCount).toBe(2);
      expect(result.unhealthyCount).toBe(1);
      expect(result.unknownCount).toBe(1);
      expect(result.status).toBe('ACTIVE');
    });

    it('should handle fleet with no instances', async () => {
      mockFleetRepo.findByIdWithInstances.mockResolvedValue({
        id: 'fleet-123',
        status: 'ACTIVE',
        instances: [],
        profiles: [],
      } as any);
      mockFleetRepo.getHealthSummary.mockResolvedValue({
        fleetId: 'fleet-123',
        fleetName: 'Test Fleet',
        totalInstances: 0,
        healthyCounts: {
          healthy: 0,
          unhealthy: 0,
          degraded: 0,
          unknown: 0,
        },
        statusCounts: {
          running: 0,
          stopped: 0,
          error: 0,
          creating: 0,
          pending: 0,
          other: 0,
        },
      });

      const result = await service.getHealth('fleet-123');

      expect(result.totalInstances).toBe(0);
      expect(result.healthyCount).toBe(0);
    });
  });

  describe('remove', () => {
    it('should delete fleet successfully', async () => {
      mockFleetRepo.findByIdWithInstances.mockResolvedValue({
        id: 'fleet-123',
        environment: 'dev',
        instances: [],
        profiles: [],
      } as any);
      mockBotInstanceRepo.count!.mockResolvedValue(0);
      mockFleetRepo.delete.mockResolvedValue(undefined);

      await service.remove('fleet-123');

      expect(mockFleetRepo.delete).toHaveBeenCalledWith('fleet-123');
    });

    it('should throw BadRequestException for fleet with instances', async () => {
      mockFleetRepo.findByIdWithInstances.mockResolvedValue({
        id: 'fleet-123',
        environment: 'dev',
        instances: [],
        profiles: [],
      } as any);
      mockBotInstanceRepo.count!.mockResolvedValue(5);

      await expect(service.remove('fleet-123')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent fleet', async () => {
      mockFleetRepo.findByIdWithInstances.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
