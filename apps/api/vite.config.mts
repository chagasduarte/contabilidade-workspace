import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/api',
  plugins: [tsconfigPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    name: 'api',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    passWithNoTests: true,
    env: {
      // Segredo fixo apenas para testes (a API exige JWT_SECRET no boot)
      JWT_SECRET: 'test-secret',
      // Trava: nenhum teste pode alcançar um Postgres real (ex.: túnel em 127.0.0.1:5432).
      // A porta 1 recusa conexão imediatamente; specs devem mockar core/config/database.
      DATABASE_URL: 'postgres://teste:teste@127.0.0.1:1/nao_usar',
      DB_SSL: 'false',
    },
    coverage: {
      reportsDirectory: '../../coverage/apps/api',
      provider: 'v8' as const,
    },
  },
}));
