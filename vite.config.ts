import { defineConfig } from 'vite';

/**
 * GitHub Pages (Project site): задайте при сборке
 * `VITE_BASE_PATH=/<имя-репозитория>/` — так делает workflow в `.github/workflows`.
 * Локально `npm run dev` и `npm run build` без переменной используют base `/`.
 */
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
});
