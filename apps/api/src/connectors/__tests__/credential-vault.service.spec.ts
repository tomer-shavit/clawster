/**
 * Unit Tests - CredentialVaultService
 */
import { NotFoundException } from "@nestjs/common";
import { CredentialVaultService } from "../credential-vault.service";
import { CredentialEncryptionService } from "../credential-encryption.service";

jest.mock("@clawster/database", () => ({
  prisma: {
    integrationConnector: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

import { prisma } from "@clawster/database";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const mockEncryption = {
  encrypt: jest.fn((obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString("base64"),
  ),
  decrypt: jest.fn((b64: string) =>
    JSON.parse(Buffer.from(b64, "base64").toString()),
  ),
  mask: jest.fn((type: string, config: Record<string, unknown>) => {
    if (type === "aws-account") {
      return {
        accessKeyId: "AKIA••••XXXX",
        secretAccessKey: "••••••••",
        region: config.region,
      };
    }
    return { provider: config.provider, apiKey: "sk-ant-••••XXXX" };
  }),
} as unknown as CredentialEncryptionService;

describe("CredentialVaultService", () => {
  let service: CredentialVaultService;

  beforeEach(() => {
    service = new CredentialVaultService(mockEncryption);
    jest.clearAllMocks();
  });

  describe("save", () => {
    it("encrypts credentials and creates connector", async () => {
      const now = new Date();
      (mockPrisma.integrationConnector.create as jest.Mock).mockResolvedValue({
        id: "cred-1",
        name: "My AWS Creds",
        type: "aws-account",
        config: "encrypted-base64",
        workspaceId: "ws-1",
        createdAt: now,
      });

      const dto = {
        workspaceId: "ws-1",
        name: "My AWS Creds",
        type: "aws-account",
        credentials: {
          accessKeyId: "AKIAIOSFODNN7EXAMPLE",
          secretAccessKey: "secret",
          region: "us-east-1",
        },
      };

      const result = await service.save(dto, "user-1");

      expect(mockEncryption.encrypt).toHaveBeenCalledWith(dto.credentials);
      expect(mockPrisma.integrationConnector.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId: "ws-1",
            name: "My AWS Creds",
            type: "aws-account",
            createdBy: "user-1",
          }),
        }),
      );
      expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "credential.save",
            resourceId: "cred-1",
            actor: "user-1",
          }),
        }),
      );
      expect(result).toHaveProperty("id", "cred-1");
      expect(result).toHaveProperty("maskedConfig");
    });
  });

  describe("listSaved", () => {
    it("returns masked credentials", async () => {
      const credentials = { accessKeyId: "AKIA1234", secretAccessKey: "sec", region: "us-east-1" };
      const encryptedConfig = Buffer.from(JSON.stringify(credentials)).toString("base64");

      (mockPrisma.integrationConnector.findMany as jest.Mock).mockResolvedValue([
        {
          id: "cred-1",
          name: "Cred One",
          type: "aws-account",
          config: encryptedConfig,
          createdAt: new Date(),
        },
        {
          id: "cred-2",
          name: "Cred Two",
          type: "aws-account",
          config: encryptedConfig,
          createdAt: new Date(),
        },
      ]);

      const result = await service.listSaved({ workspaceId: "ws-1" });

      expect(result).toHaveLength(2);
      expect(mockEncryption.decrypt).toHaveBeenCalledTimes(2);
      expect(mockEncryption.mask).toHaveBeenCalledTimes(2);
      expect(result[0].maskedConfig).toEqual(
        expect.objectContaining({ accessKeyId: "AKIA••••XXXX" }),
      );
    });
  });

  describe("resolve", () => {
    it("returns decrypted credentials and increments usage", async () => {
      const credentials = { accessKeyId: "AKIA1234", secretAccessKey: "sec", region: "us-east-1" };
      const encryptedConfig = Buffer.from(JSON.stringify(credentials)).toString("base64");

      (mockPrisma.integrationConnector.findUnique as jest.Mock).mockResolvedValue({
        id: "cred-1",
        name: "My Cred",
        type: "aws-account",
        config: encryptedConfig,
        workspaceId: "ws-1",
      });
      (mockPrisma.integrationConnector.update as jest.Mock).mockResolvedValue({});

      const result = await service.resolve("cred-1", "user-1", "ws-1");

      expect(mockEncryption.decrypt).toHaveBeenCalledWith(encryptedConfig);
      expect(mockPrisma.integrationConnector.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cred-1" },
          data: expect.objectContaining({
            usageCount: { increment: 1 },
          }),
        }),
      );
      expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "credential.access",
            resourceId: "cred-1",
            actor: "user-1",
          }),
        }),
      );
      expect(result).toEqual(credentials);
    });

    it("throws NotFoundException for missing credential", async () => {
      (mockPrisma.integrationConnector.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.resolve("non-existent", "user-1", "ws-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NotFoundException when workspace does not match", async () => {
      (mockPrisma.integrationConnector.findUnique as jest.Mock).mockResolvedValue({
        id: "cred-1",
        name: "My Cred",
        type: "aws-account",
        config: "encrypted",
        workspaceId: "ws-OTHER",
      });

      await expect(service.resolve("cred-1", "user-1", "ws-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("delete", () => {
    it("removes credential and creates audit event", async () => {
      (mockPrisma.integrationConnector.findUnique as jest.Mock).mockResolvedValue({
        id: "cred-1",
        name: "My Cred",
        type: "aws-account",
        workspaceId: "ws-1",
      });
      (mockPrisma.integrationConnector.delete as jest.Mock).mockResolvedValue({});

      await service.delete("cred-1", "user-1", "ws-1");

      expect(mockPrisma.integrationConnector.delete).toHaveBeenCalledWith({
        where: { id: "cred-1" },
      });
      expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "credential.delete",
            resourceId: "cred-1",
            actor: "user-1",
          }),
        }),
      );
    });
  });
});
