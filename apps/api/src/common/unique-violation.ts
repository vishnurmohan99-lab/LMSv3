import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

/**
 * Runs a Prisma write and turns a unique-constraint violation (P2002) into a friendly
 * ConflictException instead of letting the raw Prisma error reach the client as a 500.
 */
export async function withUniqueNameCheck<T>(fn: () => Promise<T>, entityLabel: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictException(`A ${entityLabel} with this name already exists`);
    }
    throw err;
  }
}
