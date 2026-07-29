import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { ConflictError, NotFoundError, validateThreshold } from '../../domain';

export interface CreateSignerGroupInput {
  ownerUserId?: string;
  name: string;
  description?: string;
  threshold: number;
  totalSigners: number;
}

export interface UpdateSignerGroupInput {
  name?: string;
  description?: string;
  threshold?: number;
  totalSigners?: number;
  isEnabled?: boolean;
}

export interface AddSignerGroupMemberInput {
  userId: string;
  role?: string;
  weight?: number;
}

/** Manages M-of-N signer groups (e.g. 2-of-3, 3-of-5) referenced by approval policies. */
@Injectable()
export class SignerGroupService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.signerGroup.findMany({
      orderBy: { createdAt: 'desc' },
      include: { members: true },
    });
  }

  async get(id: string) {
    const group = await this.prisma.signerGroup.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!group) throw new NotFoundError('Signer group not found');
    return group;
  }

  async create(input: CreateSignerGroupInput) {
    if (!validateThreshold(input.threshold, input.totalSigners)) {
      throw new ConflictError('threshold must be between 1 and totalSigners');
    }
    return this.prisma.signerGroup.create({
      data: {
        ownerUserId: input.ownerUserId,
        name: input.name,
        description: input.description,
        threshold: input.threshold,
        totalSigners: input.totalSigners,
      },
    });
  }

  async update(id: string, input: UpdateSignerGroupInput) {
    const group = await this.get(id);
    const threshold = input.threshold ?? group.threshold;
    const totalSigners = input.totalSigners ?? group.totalSigners;
    if (!validateThreshold(threshold, totalSigners)) {
      throw new ConflictError('threshold must be between 1 and totalSigners');
    }
    return this.prisma.signerGroup.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        threshold: input.threshold,
        totalSigners: input.totalSigners,
        isEnabled: input.isEnabled,
      },
    });
  }

  async addMember(groupId: string, input: AddSignerGroupMemberInput) {
    await this.get(groupId);
    const existing = await this.prisma.signerGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: input.userId } },
    });
    if (existing) {
      return this.prisma.signerGroupMember.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          role: input.role ?? existing.role,
          weight: input.weight ?? existing.weight,
        },
      });
    }
    return this.prisma.signerGroupMember.create({
      data: {
        groupId,
        userId: input.userId,
        role: input.role ?? 'SIGNER',
        weight: input.weight ?? 1,
      },
    });
  }

  async removeMember(groupId: string, userId: string) {
    const member = await this.prisma.signerGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) throw new NotFoundError('Signer group member not found');
    return this.prisma.signerGroupMember.update({
      where: { id: member.id },
      data: { isActive: false },
    });
  }
}
