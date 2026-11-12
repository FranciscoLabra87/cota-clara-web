import { fileURLToPath } from 'node:url';
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Las pruebas corren dentro de workerd, el mismo runtime del deploy, con una
// D1 local de miniflare. Es la única forma de que el hash de contraseñas y las
// consultas se prueben contra las APIs reales y no contra las de Node.
//
// No se lee wrangler.jsonc a propósito (`config: false`): ese archivo apunta a
// la base real, que todavía tiene un database_id de relleno, y a un bucket que
// las pruebas no necesitan. Acá se declara solo la D1.
export default defineConfig({
  plugins: [
    cloudflareTest({
      config: false,
      miniflare: {
        compatibilityDate: '2026-09-01',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: ['DB'],
        r2Buckets: ['FOTOS'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/esquema.ts'],
  },
});
