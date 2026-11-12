// lib/prisma.ts
// NOTE: path depends on the `output` in the generator block of prisma/schema.prisma (Prisma 7 `prisma-client` generator).
//import { PrismaClient } from '@/generated/prisma/client';
import {PrismaClient} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // NOTE: mirror whatever connection setup your main app uses for Supavisor (transaction mode, port 6543).
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

// Plain base client (no extensions) is cached in dev to survive hot reloads.
export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;


