import { Test, TestingModule } from '@nestjs/testing';
import { ConnectorsService } from '../../src/connectors/services/connectors.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EncryptionService } from '../../src/common/encryption.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConnectorType } from '@prisma/client';

describe('ConnectorsService', () => {
  let service: ConnectorsService;
  let prisma: jest.Mocked<PrismaService>;
  let encryptionService: EncryptionService;

  const mockConnector = {
    id: 'conn-123',
    name: 'Test Connector',
    type: ConnectorType.OPENAI,
    config: JSON.stringify({ encrypted: 'enc', iv: 'iv', tag: 'tag', v: 1 }),
    isEncrypted: true,
    userId: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
  };

  const mockConfig = {
    apiKey: 'sk-test-123',
    organizationId: 'org-123',
  };

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars!!!';
    encryptionService = new EncryptionService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectorsService,
        {
          provide: PrismaService,
          useValue: {
            connector: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: EncryptionService,
          useValue: encryptionService,
        },
      ],
    }).compile();

    service = module.get<ConnectorsService>(ConnectorsService);
    prisma = module.get(PrismaService);
  });

  describe('findAll', () => {
    it('should return all connectors for user with decrypted configs', async () => {
      const encryptedConfig = encryptionService.encryptJson(mockConfig);
      prisma.connector.findMany.mockResolvedValue([
        { ...mockConnector, config: encryptedConfig },
      ]);

      const result = await service.findAll('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].config).toEqual(mockConfig);
    });
  });

  describe('findOne', () => {
    it('should return connector with decrypted config', async () => {
      const encryptedConfig = encryptionService.encryptJson(mockConfig);
      prisma.connector.findUnique.mockResolvedValue({
        ...mockConnector,
        config: encryptedConfig,
        userId: 'user-123',
      });

      const result = await service.findOne('conn-123', 'user-123');

      expect(result.config).toEqual(mockConfig);
    });

    it('should throw NotFoundException when connector not found', async () => {
      prisma.connector.findUnique.mockResolvedValue(null);

      await expect(service.findOne('conn-123', 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user does not own connector', async () => {
      const encryptedConfig = encryptionService.encryptJson(mockConfig);
      prisma.connector.findUnique.mockResolvedValue({
        ...mockConnector,
        config: encryptedConfig,
        userId: 'different-user',
      });

      await expect(service.findOne('conn-123', 'user-123')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    it('should encrypt config and create connector', async () => {
      const encryptedConfig = encryptionService.encryptJson(mockConfig);
      prisma.connector.create.mockResolvedValue({
        ...mockConnector,
        config: encryptedConfig,
      });

      const result = await service.create(
        {
          name: 'Test Connector',
          type: ConnectorType.OPENAI,
          config: mockConfig,
        },
        'user-123',
      );

      expect(prisma.connector.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isEncrypted: true,
            userId: 'user-123',
          }),
        }),
      );
      expect(result.config).toEqual(mockConfig);
    });
  });
});
