import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  // Optional: configure seed command here too
  migrations: {
    path: 'prisma/migrations',
    // seed: 'ts-node prisma/seed.ts',   // or 'tsx prisma/seed.ts'
  },
});