// prisma.config.ts — Prisma 7: CLI-only connection (generate / db pull). Runtime uses the adapter in lib/prisma.ts.
// This project must NEVER run `prisma migrate` or `prisma db push`: the MAIN app owns the schema.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: env('DIRECT_URL') },
});
