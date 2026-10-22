/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

const version = commit();

export default defineConfig({
  // Relative base: the same build works at a domain root or under /<repo>/ on GitHub Pages.
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { target: 'es2022', chunkSizeWarningLimit: 300 },
  plugins: [
    {
      name: 'version-file',
      // Lets the post-deploy check wait until the new build is live.
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ commit: version }) });
      },
    },
  ],
  test: { include: ['src/**/*.test.ts'] },
});
