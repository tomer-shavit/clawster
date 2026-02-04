/**
 * Unit Tests - Bot Instances Service
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BotInstancesService } from './bot-instances.service';
import {
  BOT_INSTANCE_REPOSITORY,
  IBotInstanceRepository,
  FLEET_REPOSITORY,
  IFleetRepository,
} from '@clawster/database';
import { ReconcilerService } from '../reconciler/reconciler.service';

// Mock the core module
jest.mock('@clawster/core', () => ({
  PolicyEngine: jest.fn().mockImplementation(() => ({
    validate: jest.fn().mockReturnValue({ valid: true, violations: [] }),
  })),
}));

describe('BotInstancesService', () => {
  let service: BotInstancesService;
  let module: TestingModule;

  const mockBotInstanceRepo: jest.Mocked<Partial<IBotInstanceRepository>> = {
    findFirst: jest.fn(),
    findById: jest.fn(),
    findByIds: jest.fn(),
    findMany: jest.fn(),
    findManyWithRelations: jest.fn(),
    findOneWithRelations: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    updateHealth: jest.fn(),
    count: jest.fn(),
    groupByStatus: jest.fn(),
    groupByHealth: jest.fn(),
    groupByFleet: jest.fn(),
    getGatewayConnection: jest.fn(),
  };

  const mockFleetRepo: jest.Mocked<Partial<IFleetRepository>> = {
    findById: jest.fn(),
  };

  const mockReconciler: jest.Mocked<Partial<ReconcilerService>> = {
    reconcile: jest.fn(),
    stop: jest.fn(),
    delete: jest.fn(),
    doctor: jest.fn(),
    updateResources: jest.fn(),
  };

  const validManifest = {
    apiVersion: 'clawster/v1',
    kind: 'OpenClawInstance',
    metadata: {
      name: 'test-bot',
      workspace: 'default',
      environment: 'dev',
      labels: {},
    },
    spec: {
      runtime: {
        image: 'openclaw:v0.1.0',
        cpu: 0.5,
        memory: 1024,
      },
      secrets: [],
      channels: [],
      skills: { mode: 'ALLOWLIST', allowlist: ['echo'] },
      network: { inbound: 'NONE', egressPreset: 'RESTRICTED' },
      observability: { logLevel: 'info', tracing: false },
      policies: { forbidPublicAdmin: true, requireSecretManager: true },
    },
  };

  const createTestModule = async () => {
    module = await Test.createTestingModule({
      providers: [
        BotInstancesService,
        {
          provide: BOT_INSTANCE_REPOSITORY,
          useValue: mockBotInstanceRepo,
        },
        {
          provide: FLEET_REPOSITORY,
          useValue: mockFleetRepo,
        },
        {
          provide: ReconcilerService,
          useValue: mockReconciler,
        },
      ],
    }).compile();

    service = module.get<BotInstancesService>(BotInstancesService);
  };

  beforeEach(async () => {
    // Reset to valid PolicyEngine mock
    const { PolicyEngine } = jest.requireMock('@clawster/core');
    PolicyEngine.mockImplementation(() => ({
      validate: jest.fn().mockReturnValue({ valid: true, violations: [] }),
    }));
    
    await createTestModule();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('create', () => {
    const createDto = {
      workspaceId: 'workspace-123',
      fleetId: 'fleet-123',
      name: 'test-instance',
      desiredManifest: validManifest,
      tags: {},
      createdBy: 'user-123',
    };

    it('should create a bot instance successfully', async () => {
      mockBotInstanceRepo.findFirst!.mockResolvedValue(null);
      mockFleetRepo.findById!.mockResolvedValue({ id: 'fleet-123' } as any);
      mockBotInstanceRepo.create!.mockResolvedValue({
        id: 'bot-123',
        ...createDto,
        status: 'CREATING',
        health: 'UNKNOWN',
        overlayIds: [],
        metadata: {},
      } as any);

      const result = await service.create(createDto);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('test-instance');
      expect(result.status).toBe('CREATING');
    });

    it('should throw BadRequestException for duplicate name', async () => {
      mockBotInstanceRepo.findFirst!.mockResolvedValue({
        id: 'existing-bot',
        name: 'test-instance',
      } as any);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent fleet', async () => {
      mockBotInstanceRepo.findFirst!.mockResolvedValue(null);
      mockFleetRepo.findById!.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid manifest', async () => {
      // Set up the invalid mock before creating the service
      const { PolicyEngine } = jest.requireMock('@clawster/core');
      PolicyEngine.mockImplementation(() => ({
        validate: jest.fn().mockReturnValue({
          valid: false,
          violations: [{ severity: 'ERROR', message: 'Invalid CPU' }],
        }),
      }));

      // Re-create the module with the new mock
      await createTestModule();

      mockBotInstanceRepo.findFirst!.mockResolvedValue(null);
      mockFleetRepo.findById!.mockResolvedValue({ id: 'fleet-123' } as any);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return list of instances', async () => {
      mockBotInstanceRepo.findManyWithRelations!.mockResolvedValue([
        { id: 'bot-1', name: 'Bot 1' },
        { id: 'bot-2', name: 'Bot 2' },
      ] as any);

      const result = await service.findAll({ workspaceId: 'workspace-123' });

      expect(result).toHaveLength(2);
    });

    it('should filter by fleet', async () => {
      mockBotInstanceRepo.findManyWithRelations!.mockResolvedValue([]);

      await service.findAll({ workspaceId: 'workspace-123', fleetId: 'fleet-123' });

      expect(mockBotInstanceRepo.findManyWithRelations).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-123',
          fleetId: 'fleet-123',
        })
      );
    });

    it('should filter by status', async () => {
      mockBotInstanceRepo.findManyWithRelations!.mockResolvedValue([]);

      await service.findAll({ workspaceId: 'workspace-123', status: 'RUNNING' });

      expect(mockBotInstanceRepo.findManyWithRelations).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-123',
          status: 'RUNNING',
        })
      );
    });
  });

  describe('findOne', () => {
    it('should return instance by id', async () => {
      mockBotInstanceRepo.findOneWithRelations!.mockResolvedValue({
        id: 'bot-123',
        name: 'Test Bot',
        fleet: {},
        connectorBindings: [],
      } as any);

      const result = await service.findOne('bot-123');

      expect(result.id).toBe('bot-123');
    });

    it('should throw NotFoundException for non-existent instance', async () => {
      mockBotInstanceRepo.findOneWithRelations!.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update instance successfully', async () => {
      mockBotInstanceRepo.findOneWithRelations!.mockResolvedValue({ id: 'bot-123' } as any);
      mockBotInstanceRepo.update!.mockResolvedValue({
        id: 'bot-123',
        tags: JSON.stringify({ team: 'platform' }),
      } as any);

      const result = await service.update('bot-123', { tags: { team: 'platform' } });

      expect(result.id).toBe('bot-123');
      expect(JSON.parse(result.tags)).toEqual({ team: 'platform' });
    });

    it('should validate manifest on update', async () => {
      // Set up the invalid mock before creating the service
      const { PolicyEngine } = jest.requireMock('@clawster/core');
      PolicyEngine.mockImplementation(() => ({
        validate: jest.fn().mockReturnValue({
          valid: false,
          violations: [{ severity: 'ERROR', message: 'Invalid image' }],
        }),
      }));

      // Re-create the module with the new mock
      await createTestModule();

      mockBotInstanceRepo.findOneWithRelations!.mockResolvedValue({ id: 'bot-123' } as any);

      await expect(
        service.update('bot-123', { desiredManifest: validManifest })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    it('should update status successfully', async () => {
      mockBotInstanceRepo.findOneWithRelations!.mockResolvedValue({ id: 'bot-123' } as any);
      mockBotInstanceRepo.updateStatus!.mockResolvedValue({
        id: 'bot-123',
        status: 'RUNNING',
      } as any);

      const result = await service.updateStatus('bot-123', 'RUNNING');

      expect(result.status).toBe('RUNNING');
    });
  });

  describe('updateHealth', () => {
    it('should update health successfully', async () => {
      mockBotInstanceRepo.findOneWithRelations!.mockResolvedValue({ id: 'bot-123' } as any);
      mockBotInstanceRepo.updateHealth!.mockResolvedValue({
        id: 'bot-123',
        health: 'HEALTHY',
      } as any);

      const result = await service.updateHealth('bot-123', 'HEALTHY');

      expect(result.health).toBe('HEALTHY');
      expect(mockBotInstanceRepo.updateHealth).toHaveBeenCalledWith(
        'bot-123',
        'HEALTHY',
        expect.any(Date)
      );
    });
  });

  describe('restart', () => {
    it('should restart instance', async () => {
      mockBotInstanceRepo.findOneWithRelations!.mockResolvedValue({ id: 'bot-123' } as any);
      mockBotInstanceRepo.update!.mockResolvedValue({} as any);

      await service.restart('bot-123');

      expect(mockBotInstanceRepo.update).toHaveBeenCalledWith(
        'bot-123',
        expect.objectContaining({
          status: 'RECONCILING',
          restartCount: { increment: 1 },
          lastReconcileAt: expect.any(Date),
        })
      );
    });
  });

  describe('pause', () => {
    it('should pause instance', async () => {
      mockBotInstanceRepo.findOneWithRelations!.mockResolvedValue({ id: 'bot-123' } as any);
      mockBotInstanceRepo.update!.mockResolvedValue({} as any);

      await service.pause('bot-123');

      expect(mockBotInstanceRepo.update).toHaveBeenCalledWith(
        'bot-123',
        expect.objectContaining({ status: 'PAUSED' })
      );
    });
  });

  describe('resume', () => {
    it('should resume instance', async () => {
      mockBotInstanceRepo.findOneWithRelations!.mockResolvedValue({ id: 'bot-123' } as any);
      mockBotInstanceRepo.update!.mockResolvedValue({} as any);
      mockReconciler.reconcile!.mockResolvedValue({} as any);

      await service.resume('bot-123');

      expect(mockBotInstanceRepo.update).toHaveBeenCalledWith(
        'bot-123',
        expect.objectContaining({ status: 'PENDING' })
      );
    });
  });

  describe('stop', () => {
    it('should stop instance', async () => {
      mockBotInstanceRepo.findOneWithRelations!.mockResolvedValue({ id: 'bot-123' } as any);
      mockReconciler.stop!.mockResolvedValue(undefined);

      await service.stop('bot-123');

      expect(mockReconciler.stop).toHaveBeenCalledWith('bot-123');
    });
  });

  describe('remove', () => {
    it('should mark instance for deletion', async () => {
      mockBotInstanceRepo.findOneWithRelations!.mockResolvedValue({ id: 'bot-123' } as any);
      mockReconciler.delete!.mockResolvedValue(undefined);

      await service.remove('bot-123');

      expect(mockReconciler.delete).toHaveBeenCalledWith('bot-123');
    });
  });

  describe('getDashboardData', () => {
    it('should return dashboard data', async () => {
      mockBotInstanceRepo.count!.mockResolvedValue(10);
      mockBotInstanceRepo.groupByStatus!.mockResolvedValue([
        { status: 'RUNNING', _count: 5 },
        { status: 'PAUSED', _count: 2 },
      ]);
      mockBotInstanceRepo.groupByHealth!.mockResolvedValue([
        { health: 'HEALTHY', _count: 8 },
        { health: 'UNKNOWN', _count: 2 },
      ]);
      mockBotInstanceRepo.findManyWithRelations!.mockResolvedValue([]);
      mockBotInstanceRepo.groupByFleet!.mockResolvedValue([]);

      const result = await service.getDashboardData('workspace-123');

      expect(result.summary.totalInstances).toBe(10);
      expect(result.summary.statusBreakdown).toHaveProperty('RUNNING', 5);
      expect(result.summary.healthBreakdown).toHaveProperty('HEALTHY', 8);
      expect(result).toHaveProperty('recentInstances');
      expect(result).toHaveProperty('fleetDistribution');
    });
  });
});
