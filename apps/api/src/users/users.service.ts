import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role, User } from '../../generated/prisma/client';

export type SafeUser = Omit<User, 'passwordHash'>;

function toSafeUser(user: User): SafeUser {
  const { passwordHash, ...safe } = user;
  return safe;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: { email: string; passwordHash: string; fullName: string; role?: Role }) {
    return this.prisma.user.create({ data });
  }

  async findAll(): Promise<SafeUser[]> {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map(toSafeUser);
  }

  async getSafeProfile(id: string): Promise<SafeUser> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return toSafeUser(user);
  }

  async updateProfile(id: string, data: { fullName: string }): Promise<SafeUser> {
    const user = await this.prisma.user.update({ where: { id }, data });
    return toSafeUser(user);
  }

  async createByAdmin(data: { fullName: string; email: string; password: string; role: Role }): Promise<SafeUser> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await this.prisma.user.create({
      data: { email: data.email, passwordHash, fullName: data.fullName, role: data.role },
    });
    return toSafeUser(user);
  }

  async updateRole(id: string, role: Role): Promise<SafeUser> {
    const user = await this.prisma.user.update({ where: { id }, data: { role } });
    return toSafeUser(user);
  }
}
