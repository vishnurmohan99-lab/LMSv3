import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';

@Injectable()
export class TodosService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: JwtPayload, from?: string, to?: string) {
    return this.prisma.todo.findMany({
      where: {
        userId: user.sub,
        date: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
  }

  create(user: JwtPayload, dto: CreateTodoDto) {
    return this.prisma.todo.create({
      data: { userId: user.sub, date: new Date(dto.date), text: dto.text },
    });
  }

  private async requireOwnTodo(id: string, user: JwtPayload) {
    const todo = await this.prisma.todo.findUnique({ where: { id } });
    if (!todo) throw new NotFoundException('To-do not found');
    if (todo.userId !== user.sub) throw new ForbiddenException('You do not own this to-do');
    return todo;
  }

  async update(id: string, user: JwtPayload, dto: UpdateTodoDto) {
    await this.requireOwnTodo(id, user);
    return this.prisma.todo.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: JwtPayload) {
    await this.requireOwnTodo(id, user);
    await this.prisma.todo.delete({ where: { id } });
    return { success: true };
  }
}
