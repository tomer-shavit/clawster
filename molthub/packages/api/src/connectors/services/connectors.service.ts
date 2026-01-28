import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption.service';
import { CreateConnectorDto } from '../dto/create-connector.dto';
import { UpdateConnectorDto } from '../dto/update-connector.dto';

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async findAll(userId: string) {
    const connectors = await this.prisma.connector.findMany({
      where: { userId },
    });

    // Decrypt configs for response
    return connectors.map(connector => ({
      ...connector,
      config: this.encryptionService.decryptJson(connector.config),
    }));
  }

  async findOne(id: string, userId: string) {
    const connector = await this.prisma.connector.findUnique({
      where: { id },
    });

    if (!connector) {
      throw new NotFoundException('Connector not found');
    }

    if (connector.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return {
      ...connector,
      config: this.encryptionService.decryptJson(connector.config),
    };
  }

  async create(createConnectorDto: CreateConnectorDto, userId: string) {
    // Encrypt the config before saving
    const encryptedConfig = this.encryptionService.encryptJson(createConnectorDto.config);

    const connector = await this.prisma.connector.create({
      data: {
        ...createConnectorDto,
        config: encryptedConfig,
        isEncrypted: true,
        userId,
      },
    });

    return {
      ...connector,
      config: createConnectorDto.config, // Return original config in response
    };
  }

  async update(id: string, updateConnectorDto: UpdateConnectorDto, userId: string) {
    const existing = await this.prisma.connector.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Connector not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Encrypt config if provided
    const data: any = { ...updateConnectorDto };
    if (updateConnectorDto.config) {
      data.config = this.encryptionService.encryptJson(updateConnectorDto.config);
      data.isEncrypted = true;
    }

    const connector = await this.prisma.connector.update({
      where: { id },
      data,
    });

    return {
      ...connector,
      config: updateConnectorDto.config || this.encryptionService.decryptJson(connector.config),
    };
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.connector.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Connector not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.connector.delete({
      where: { id },
    });

    return { success: true };
  }
}
