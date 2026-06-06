import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig, defineProject, mergeConfig } from 'vitest/config';

export default defineConfig(async (_env) => {
  const migrationsPath = path.join(__dirname, 'migrations');
  const migrations = await readD1Migrations(migrationsPath);

  return mergeConfig(
    {
      test: {
        coverage: {
          provider: 'istanbul' as const,
          reporter: ['html'],
        },
      },
    },
    defineProject({
      plugins: [
        cloudflareTest({
          wrangler: {
            configPath: './wrangler.jsonc',
          },
          miniflare: {
            bindings: { TEST_MIGRATIONS: migrations },
          },
        }),
      ],
      test: {
        setupFiles: ['./test/apply-migrations.ts'],
      },
    })
  );
});
