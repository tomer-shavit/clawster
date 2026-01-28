import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePolicyDto } from '../dto/create-policy.dto';
import { UpdatePolicyDto } from '../dto/update-policy.dto';

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const policies = await this.prisma.policy.findMany({
      where: { userId },
    });

    return policies.map(policy => ({
      ...policy,
      rules: JSON.parse(policy.rules),
    }));
  }

  async findOne(id: string, userId: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { id },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    if (policy.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return {
      ...policy,
      rules: JSON.parse(policy.rules),
    };
  }

  async create(createPolicyDto: CreatePolicyDto, userId: string) {
    const policy = await this.prisma.policy.create({
      data: {
        ...createPolicyDto,
        rules: JSON.stringify(createPolicyDto.rules),
        userId,
      },
    });

    return {
      ...policy,
      rules: createPolicyDto.rules,
    };
  }

  async update(id: string, updatePolicyDto: UpdatePolicyDto, userId: string) {
    const existing = await this.prisma.policy.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Policy not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const data: any = { ...updatePolicyDto };
    if (updatePolicyDto.rules) {
      data.rules = JSON.stringify(updatePolicyDto.rules);
    }

    const policy = await this.prisma.policy.update({
      where: { id },
      data,
    });

    return {
      ...policy,
      rules: updatePolicyDto.rules || JSON.parse(policy.rules),
    };
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.policy.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Policy not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.policy.delete({
      where: { id },
    });

    return { success: true };
  }
}
