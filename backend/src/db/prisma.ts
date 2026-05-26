import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var kaplumbagaPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.kaplumbagaPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.kaplumbagaPrisma = prisma;
}
