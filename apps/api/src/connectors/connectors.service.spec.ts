/**
 * Unit Tests - Connectors Service
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConnectorsService } from './connectors.service';
import {
  CONNECTOR_REPOSITORY,
  IConnectorRepository,
  IntegrationConnector,
} from '@clawster/database';

describe('ConnectorsService', () => {
  let service: ConnectorsService;

  const mockConnectorRepo: jest.Mocked<IConnectorRepository> = {
    createConnector: jest.fn(),
    findManyConnectors: jest.fn(),
    findConnectorById: jest.fn(),
    findConnectorsByWorkspace: jest.fn(),
    countConnectors: jest.fn(),
    updateConnector: jest.fn(),
    deleteConnector: jest.fn(),
    updateConnectorStatus: jest.fn(),
    recordTestResult: jest.fn(),
    incrementUsageCount: jest.fn(),
    findBindingById: jest.fn(),
    findBindingsByBotInstance: jest.fn(),
    findBindingsByConnector: jest.fn(),
    createBinding: jest.fn(),
    updateBinding: jest.fn(),
    deleteBinding: jest.fn(),
    updateBindingHealth: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectorsService,
        { provide: CONNECTOR_REPOSITORY, useValue: mockConnectorRepo },
      ],
    }).compile();

    service = module.get<ConnectorsService>(ConnectorsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      workspaceId: 'workspace-123',
      name: 'Test Connector',
      description: 'A test connector for unit tests',
      type: 'openai' as const,
      config: {
        type: 'openai',
        apiKey: {
          name: 'openai-key',
          provider: 'aws-secrets-manager' as const,
          arn: 'arn:aws:secretsmanager:us-east-1:123:secret:openai',
        },
        defaultModel: 'gpt-4',
      },
      isShared: true,
      tags: {},
    };

    it('should create a connector successfully', async () => {
      mockConnectorRepo.createConnector.mockResolvedValue({
        id: 'conn-123',
        workspaceId: createDto.workspaceId,
        name: createDto.name,
        description: createDto.description,
        type: createDto.type,
        config: JSON.stringify(createDto.config),
        isShared: createDto.isShared,
        tags: JSON.stringify(createDto.tags),
        status: 'PENDING',
        allowedInstanceIds: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as IntegrationConnector);

      const result = await service.create(createDto);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Test Connector');
      expect(result.status).toBe('PENDING');
      expect(mockConnectorRepo.createConnector).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Connector',
          type: 'openai',
          isShared: true,
        })
      );
    });

    it('should create a non-shared connector', async () => {
      const privateDto = {
        ...createDto,
        isShared: false,
        allowedInstanceIds: ['bot-1', 'bot-2'],
      };

      mockConnectorRepo.createConnector.mockResolvedValue({
        id: 'conn-123',
        workspaceId: privateDto.workspaceId,
        name: privateDto.name,
        description: privateDto.description,
        type: privateDto.type,
        config: JSON.stringify(privateDto.config),
        isShared: privateDto.isShared,
        allowedInstanceIds: JSON.stringify(privateDto.allowedInstanceIds),
        tags: JSON.stringify(privateDto.tags),
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as IntegrationConnector);

      const result = await service.create(privateDto);

      expect(result.isShared).toBe(false);
      expect(result.allowedInstanceIds).toBe(JSON.stringify(['bot-1', 'bot-2']));
    });
  });

  describe('findAll', () => {
    it('should return list of connectors', async () => {
      mockConnectorRepo.findManyConnectors.mockResolvedValue({
        data: [
          { id: 'conn-1', name: 'Connector 1', type: 'openai' } as IntegrationConnector,
          { id: 'conn-2', name: 'Connector 2', type: 'slack' } as IntegrationConnector,
        ],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await service.findAll({ workspaceId: 'workspace-123' });

      expect(result).toHaveLength(2);
      expect(mockConnectorRepo.findManyConnectors).toHaveBeenCalledWith({
        workspaceId: 'workspace-123',
        type: undefined,
        status: undefined,
        isShared: undefined,
      });
    });

    it('should filter by type', async () => {
      mockConnectorRepo.findManyConnectors.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await service.findAll({ workspaceId: 'workspace-123', type: 'openai' });

      expect(mockConnectorRepo.findManyConnectors).toHaveBeenCalledWith({
        workspaceId: 'workspace-123',
        type: 'openai',
        status: undefined,
        isShared: undefined,
      });
    });

    it('should filter by status', async () => {
      mockConnectorRepo.findManyConnectors.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await service.findAll({ workspaceId: 'workspace-123', status: 'ACTIVE' });

      expect(mockConnectorRepo.findManyConnectors).toHaveBeenCalledWith({
        workspaceId: 'workspace-123',
        type: undefined,
        status: 'ACTIVE',
        isShared: undefined,
      });
    });

    it('should filter by isShared', async () => {
      mockConnectorRepo.findManyConnectors.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await service.findAll({ workspaceId: 'workspace-123', isShared: true });

      expect(mockConnectorRepo.findManyConnectors).toHaveBeenCalledWith({
        workspaceId: 'workspace-123',
        type: undefined,
        status: undefined,
        isShared: true,
      });
    });
  });

  describe('findOne', () => {
    it('should return connector by id', async () => {
      mockConnectorRepo.findConnectorById.mockResolvedValue({
        id: 'conn-123',
        name: 'Test Connector',
        _count: { botBindings: 0 },
      } as any);

      const result = await service.findOne('conn-123');

      expect(result.id).toBe('conn-123');
      expect(mockConnectorRepo.findConnectorById).toHaveBeenCalledWith('conn-123');
    });

    it('should throw NotFoundException for non-existent connector', async () => {
      mockConnectorRepo.findConnectorById.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update connector successfully', async () => {
      mockConnectorRepo.findConnectorById.mockResolvedValue({ id: 'conn-123' } as any);
      mockConnectorRepo.updateConnector.mockResolvedValue({
        id: 'conn-123',
        name: 'Updated Connector',
      } as IntegrationConnector);

      const result = await service.update('conn-123', { name: 'Updated Connector' });

      expect(result.name).toBe('Updated Connector');
      expect(mockConnectorRepo.updateConnector).toHaveBeenCalledWith(
        'conn-123',
        expect.objectContaining({ name: 'Updated Connector' })
      );
    });

    it('should update config', async () => {
      mockConnectorRepo.findConnectorById.mockResolvedValue({ id: 'conn-123' } as any);
      mockConnectorRepo.updateConnector.mockResolvedValue({
        id: 'conn-123',
        config: JSON.stringify({ defaultModel: 'gpt-3.5-turbo' }),
      } as IntegrationConnector);

      const result = await service.update('conn-123', {
        config: { defaultModel: 'gpt-3.5-turbo' },
      });

      expect(JSON.parse(result.config as string).defaultModel).toBe('gpt-3.5-turbo');
    });

    it('should throw NotFoundException for non-existent connector', async () => {
      mockConnectorRepo.findConnectorById.mockResolvedValue(null);

      await expect(service.update('non-existent', { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update status to ACTIVE', async () => {
      mockConnectorRepo.findConnectorById.mockResolvedValue({ id: 'conn-123' } as any);
      mockConnectorRepo.updateConnectorStatus.mockResolvedValue({
        id: 'conn-123',
        status: 'ACTIVE',
      } as IntegrationConnector);

      const result = await service.updateStatus('conn-123', 'ACTIVE');

      expect(result.status).toBe('ACTIVE');
      expect(mockConnectorRepo.updateConnectorStatus).toHaveBeenCalledWith(
        'conn-123',
        'ACTIVE',
        undefined
      );
    });

    it('should update status to ERROR', async () => {
      mockConnectorRepo.findConnectorById.mockResolvedValue({ id: 'conn-123' } as any);
      mockConnectorRepo.updateConnectorStatus.mockResolvedValue({
        id: 'conn-123',
        status: 'ERROR',
        statusMessage: 'Connection failed',
      } as IntegrationConnector);

      const result = await service.updateStatus('conn-123', 'ERROR', 'Connection failed');

      expect(result.status).toBe('ERROR');
      expect(result.statusMessage).toBe('Connection failed');
      expect(mockConnectorRepo.updateConnectorStatus).toHaveBeenCalledWith(
        'conn-123',
        'ERROR',
        'Connection failed'
      );
    });
  });

  describe('remove', () => {
    it('should delete connector successfully', async () => {
      mockConnectorRepo.findBindingsByConnector.mockResolvedValue([]);
      mockConnectorRepo.deleteConnector.mockResolvedValue(undefined);

      await service.remove('conn-123');

      expect(mockConnectorRepo.findBindingsByConnector).toHaveBeenCalledWith('conn-123');
      expect(mockConnectorRepo.deleteConnector).toHaveBeenCalledWith('conn-123');
    });

    it('should throw BadRequestException for connector with bindings', async () => {
      mockConnectorRepo.findBindingsByConnector.mockResolvedValue([
        { id: 'binding-1' },
        { id: 'binding-2' },
        { id: 'binding-3' },
      ] as any[]);

      await expect(service.remove('conn-123')).rejects.toThrow(BadRequestException);
      expect(mockConnectorRepo.deleteConnector).not.toHaveBeenCalled();
    });

    it('should propagate error when deleting non-existent connector', async () => {
      // The service does not check existence before delete - it relies on the repository
      // to throw an error when attempting to delete a non-existent record
      mockConnectorRepo.findBindingsByConnector.mockResolvedValue([]);
      const notFoundError = new Error('Record to delete does not exist');
      mockConnectorRepo.deleteConnector.mockRejectedValue(notFoundError);

      await expect(service.remove('non-existent')).rejects.toThrow('Record to delete does not exist');
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      mockConnectorRepo.findConnectorById.mockResolvedValue({
        id: 'conn-123',
        type: 'openai',
      } as any);
      mockConnectorRepo.recordTestResult.mockResolvedValue({} as IntegrationConnector);

      const result = await service.testConnection('conn-123', {});

      expect(result.connectorId).toBe('conn-123');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('responseTimeMs');
      expect(result).toHaveProperty('checks');
      expect(mockConnectorRepo.recordTestResult).toHaveBeenCalledWith(
        'conn-123',
        true,
        'Successfully connected to OpenAI API'
      );
    });

    it('should handle connection failure', async () => {
      mockConnectorRepo.findConnectorById.mockResolvedValue({
        id: 'conn-123',
        type: 'unknown',
      } as any);
      mockConnectorRepo.recordTestResult.mockResolvedValue({} as IntegrationConnector);

      // Override performConnectionTest to simulate failure
      jest.spyOn(service as any, 'performConnectionTest').mockRejectedValue(new Error('Connection refused'));

      const result = await service.testConnection('conn-123', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection refused');
      expect(mockConnectorRepo.recordTestResult).toHaveBeenCalledWith(
        'conn-123',
        false,
        'Connection refused'
      );
    });

    it('should return 404 for non-existent connector', async () => {
      mockConnectorRepo.findConnectorById.mockResolvedValue(null);

      await expect(service.testConnection('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });
});
